import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var session: FollowUpSession

    var body: some View {
        ZStack {
            Color(red: 0.027, green: 0.043, blue: 0.078)
                .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 20) {
                Text("VANTARO")
                    .font(.system(size: 13, weight: .bold, design: .default))
                    .tracking(2.4)
                    .foregroundStyle(.white.opacity(0.55))

                switch session.state {
                case .idle:
                    statusCopy(
                        title: "Wiedervorlage",
                        body: "Öffnen Sie den Apple-Kalender-Link aus der Wiedervorlage-E-Mail. Die App schreibt den Termin direkt in Apple Kalender."
                    )
                case .loading:
                    statusCopy(title: "Wird gespeichert…", body: "Kalender-Zugriff prüfen und Termin anlegen.")
                    ProgressView()
                        .tint(.white)
                case .saved(let event):
                    statusCopy(title: "Im Kalender gespeichert", body: event.title)
                    Text(Self.whenLabel(event.followUpAt))
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundStyle(.white)
                    Button("In Kalender öffnen") {
                        session.openCalendar(at: event.followUpAt)
                    }
                    .buttonStyle(VantaroButtonStyle())
                case .failed(let message):
                    statusCopy(title: "Nicht gespeichert", body: message)
                }
            }
            .padding(28)
            .frame(maxWidth: 520, alignment: .leading)
        }
        .onOpenURL { url in
            Task { await session.handle(url: url) }
        }
    }

    private func statusCopy(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(size: 32, weight: .bold))
                .foregroundStyle(.white)
            Text(body)
                .font(.system(size: 16))
                .foregroundStyle(.white.opacity(0.72))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private static func whenLabel(_ date: Date) -> String {
        date.formatted(
            Date.FormatStyle(date: .long, time: .shortened)
                .locale(Locale(identifier: "de_DE"))
                .timeZone(.current)
        )
    }
}

private struct VantaroButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 16, weight: .bold))
            .foregroundStyle(Color(red: 0.027, green: 0.043, blue: 0.078))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(.white)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}
