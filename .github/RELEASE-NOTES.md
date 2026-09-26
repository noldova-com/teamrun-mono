TeamRun brings coding agents together in one desktop application.

Download the installer for your operating system and CPU:

| Platform | Download |
|---|---|
| Windows | `TeamRun-windows-<arch>.exe` |
| macOS | `TeamRun-mac-<arch>.dmg` |
| Linux | `TeamRun-linux-<arch>.AppImage` |

Choose `x64` for Intel/AMD computers or `arm64` for Apple Silicon and other ARM computers. GitHub's source-code downloads are not installers.

The Windows installers are signed through Microsoft Azure Artifact Signing. While the publisher is new, Windows SmartScreen may still show a warning; choose **More info** → **Run anyway**. The macOS app is signed with an Apple Developer ID and notarized by Apple. Linux requires Electron sandbox support; `APPIMAGE_EXTRACT_AND_RUN=1 ./TeamRun-linux-<arch>.AppImage` is available when FUSE mounting is unavailable.

TeamRun is in early development. Releases use numbered versions such as `0.0.1` and `0.0.2`. TeamRun updates itself on every platform: on macOS it must be in the Applications folder, and on Linux an update replaces the AppImage in place. In-app updates are verified on Windows x64 and with the Linux x64 AppImage; the other platforms are still being verified. If you use 0.0.1 or 0.0.2, or 0.0.3 on macOS, Windows ARM64 or Linux ARM64, download this version once: those versions cannot update into it.

`SHA256SUMS` and the package reports identify the downloadable files and their build revision. The `latest*.yml` files describe each platform's builds for in-app updates.

Report problems through [GitHub Issues](https://github.com/noldova-com/teamrun/issues), including the application version, OS and CPU. Keep a backup of important TeamRun data when testing early releases.
