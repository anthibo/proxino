## Proxino {{VERSION}}

Self-hosted network inspector for mobile HTTPS — a free, open alternative to Proxyman/Charles.

### Download

| Platform | File | Notes |
|---|---|---|
| macOS (Apple Silicon) | `Proxino_{{VERSION}}_aarch64.dmg` | Unsigned: right-click **Proxino.app → Open** the first time, or run `xattr -dr com.apple.quarantine /Applications/Proxino.app` |
| Windows 10/11 (x64) | `Proxino_{{VERSION}}_x64-setup.exe` | Unsigned: SmartScreen → **More info → Run anyway** |
| Linux (x64) | `Proxino_{{VERSION}}_amd64.AppImage` / `.deb` | AppImage: `chmod +x` then run |
| Any (web UI) | Run from source | See the [README](https://github.com/anthibo/proxino#from-source); PyPI package coming soon |

Checksums: `SHA256SUMS.txt`.

### Then connect a phone
Same Wi-Fi → manual HTTP proxy to the address shown in **Connect device** → install the CA from http://mitm.it (iOS: also enable full trust). Details in the [README](https://github.com/anthibo/proxino#connecting-a-device).
