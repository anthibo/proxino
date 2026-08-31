use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

/// Holds the spawned Python backend so we can kill it when the app exits.
struct Backend(Mutex<Option<Child>>);

/// Repo root = two levels up from desktop/src-tauri.
fn repo_root() -> PathBuf {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest
        .join("..")
        .join("..")
        .canonicalize()
        .unwrap_or(manifest)
}

/// Launch the mitmproxy/FastAPI backend (dev: from the repo's virtualenv).
fn spawn_backend() -> std::io::Result<Child> {
    let root = repo_root();
    Command::new(root.join(".venv/bin/mitmdump"))
        .args([
            "-s", "proxino/addon.py",
            "-p", "8080",
            "--set", "proxino_web_port=8081",
            "--set", "termlog_verbosity=warn",
        ])
        .current_dir(&root)
        .env("PROXINO_NO_BROWSER", "1")
        .spawn()
}

fn port_open() -> bool {
    let addr = "127.0.0.1:8081".parse().unwrap();
    TcpStream::connect_timeout(&addr, Duration::from_millis(400)).is_ok()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let child = spawn_backend().ok();
            app.manage(Backend(Mutex::new(child)));

            // Wait for the backend's web server, then point the window at it.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                for _ in 0..120 {
                    if port_open() {
                        if let Some(win) = handle.get_webview_window("main") {
                            if let Ok(url) = "http://127.0.0.1:8081".parse() {
                                let _ = win.navigate(url);
                            }
                        }
                        return;
                    }
                    std::thread::sleep(Duration::from_millis(500));
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Proxino")
        .run(|handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = handle.try_state::<Backend>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
