# VANTARO iOS (EventKit)

Writes Wiedervorlage events into Apple Calendar. This project only builds on a Mac with Xcode.

## Run on iPhone

1. Open `ios/Vantaro.xcodeproj` in Xcode.
2. Signing & Capabilities → select your paid Apple Developer Team. Bundle ID is `io.vantaro.app`.
3. In `ios/Vantaro/Info.plist`, set `API_BASE_URL` to the same public API that sent the email (`https://vantaro.onrender.com` in production).
4. Connect an iPhone, choose it as the run destination, press Run. Allow calendar access when asked.
5. Open the Wiedervorlage mail on that iPhone and tap **Apple Kalender**. Safari opens the HTTPS page, which launches `vantaro://wiedervorlage?...`. The app fetches `/api/calendar/wiedervorlage.json` and saves an `EKEvent`.

Local emails (`API_PUBLIC_URL=http://localhost:3001`) cannot be opened from a physical iPhone. Point both the server public URL and `API_BASE_URL` at a reachable host (Render, or your Mac’s LAN IP).
