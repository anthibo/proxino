use std::net::{SocketAddr, TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// The spawned backend, kept so it can be killed when the app exits.
struct Backend(Mutex<Option<CommandChild>>);

/// Try the preferred port on `host`; fall back to an OS-assigned free port.
fn free_port(host: &str, preferred: u16) -> u16 {
    for p in [preferred, 0] {
        if let Ok(l) = TcpListener::bind((host, p)) {
            if let Ok(addr) = l.local_addr() {
                return addr.port();
            }
        }
    }
    preferred
}

fn port_open(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    TcpStream::connect_timeout(&addr, Duration::from_millis(400)).is_ok()
}

/// Update the splash screen's status line (see desktop/src/index.html).
fn set_status(handle: &tauri::AppHandle, msg: &str, is_error: bool) {
    if let Some(win) = handle.get_webview_window("main") {
        let js = format!(
            "window.__proxinoStatus && window.__proxinoStatus({}, {})",
            serde_json::to_string(msg).unwrap_or_else(|_| "\"\"".into()),
            is_error
        );
        let _ = win.eval(&js);
    }
}

/// Like `set_status`, but retries for a couple of seconds. Used right after
/// `setup()` starts, when the splash page's own inline script (which defines
/// `window.__proxinoStatus`) may not have finished loading yet — a bare
/// `eval` in that window would silently no-op.
fn set_status_retrying(handle: tauri::AppHandle, msg: String) {
    std::thread::spawn(move || {
        for _ in 0..10 {
            set_status(&handle, &msg, true);
            std::thread::sleep(Duration::from_millis(300));
        }
    });
}

/// Kill any direct children of `pid`. The PyInstaller one-file sidecar is a
/// bootloader that forks the real interpreter and waits on it (so it can
/// clean up its extraction temp dir); killing only the bootloader orphans
/// that child instead of stopping it, leaving it bound to the proxy/web
/// ports. Sweep one level of children first so both processes go away.
#[cfg(unix)]
fn kill_child_processes(pid: u32) {
    if let Ok(output) = std::process::Command::new("pgrep")
        .arg("-P")
        .arg(pid.to_string())
        .output()
    {
        for line in String::from_utf8_lossy(&output.stdout).lines() {
            let line = line.trim();
            if !line.is_empty() {
                let _ = std::process::Command::new("kill").arg("-9").arg(line).status();
            }
        }
    }
}

#[cfg(windows)]
fn kill_child_processes(pid: u32) {
    // taskkill /T kills the whole process tree rooted at pid.
    let _ = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .output();
}

fn kill_backend(handle: &tauri::AppHandle) {
    if let Some(state) = handle.try_state::<Backend>() {
        if let Ok(mut guard) = state.0.lock() {
            if let Some(child) = guard.take() {
                kill_child_processes(child.pid());
                let _ = child.kill();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // The proxy listens on all interfaces (phones connect to it); the
            // web UI is loopback only.
            let proxy_port = free_port("0.0.0.0", 8080);
            let web_port = free_port("127.0.0.1", 8081);

            // Spawn without `?` here: a failure (e.g. a missing/corrupt
            // sidecar binary) must not propagate out of `setup()` — that
            // would abort the whole app via the `.expect(...)` below and
            // show a native "quit unexpectedly" crash dialog instead of the
            // in-window error message this is all here to provide.
            let spawn_result = (|| -> Result<_, tauri_plugin_shell::Error> {
                app.shell()
                    .sidecar("proxino-backend")?
                    .args([
                        "--proxy-port", &proxy_port.to_string(),
                        "--web-port", &web_port.to_string(),
                        "--set", "termlog_verbosity=warn",
                    ])
                    .env("PROXINO_NO_BROWSER", "1")
                    .spawn()
            })();
            let (mut rx, child) = match spawn_result {
                Ok(pair) => pair,
                Err(e) => {
                    set_status_retrying(
                        app.handle().clone(),
                        format!(
                            "Could not start the capture engine.\n\n{e}\n\nQuit and reinstall Proxino; if it keeps happening, open an issue on GitHub."
                        ),
                    );
                    return Ok(());
                }
            };
            app.manage(Backend(Mutex::new(Some(child))));

            // Relay backend output to our stderr and surface a crash in the window.
            let log_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut tail: Vec<String> = Vec::new();
                while let Some(ev) = rx.recv().await {
                    match ev {
                        CommandEvent::Stdout(b) | CommandEvent::Stderr(b) => {
                            let line = String::from_utf8_lossy(&b).trim().to_string();
                            if !line.is_empty() {
                                eprintln!("[backend] {line}");
                                tail.push(line);
                                if tail.len() > 15 {
                                    tail.remove(0);
                                }
                            }
                        }
                        CommandEvent::Terminated(t) => {
                            let msg = format!(
                                "The capture engine stopped (exit code {}).\n\n{}",
                                t.code.map(|c| c.to_string()).unwrap_or_else(|| "?".into()),
                                tail.join("\n")
                            );
                            set_status(&log_handle, &msg, true);
                            break;
                        }
                        _ => {}
                    }
                }
            });

            // Wait for the web server, then point the window at it.
            let nav_handle = app.handle().clone();
            std::thread::spawn(move || {
                for _ in 0..120 {
                    if port_open(web_port) {
                        if let Some(win) = nav_handle.get_webview_window("main") {
                            if let Ok(url) = format!("http://127.0.0.1:{web_port}").parse() {
                                let _ = win.navigate(url);
                            }
                        }
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(500));
                }
                set_status(
                    &nav_handle,
                    "The capture engine did not start within 60 seconds.\nQuit and relaunch; if it keeps happening, open an issue on GitHub.",
                    true,
                );
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Proxino")
        .run(|handle, event| match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => kill_backend(handle),
            _ => {}
        });
}
