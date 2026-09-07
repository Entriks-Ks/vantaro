import SwiftUI
import UIKit

@MainActor
final class FollowUpSession: ObservableObject {
    enum State: Equatable {
        case idle
        case loading
        case saved(FollowUpEvent)
        case failed(String)
    }

    @Published var state: State = .idle

    func handle(url: URL) async {
        guard url.scheme?.lowercased() == "vantaro" else {
            state = .failed("Ungültiger Kalender-Link.")
            return
        }

        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        func query(_ name: String) -> String? {
            items.first(where: { $0.name == name })?.value
        }

        guard let lead = query("lead"), let at = query("at"), let sig = query("sig") else {
            state = .failed("Ungültiger Kalender-Link.")
            return
        }

        state = .loading
        do {
            let event = try await FollowUpClient.shared.fetch(lead: lead, at: at, sig: sig)
            try await CalendarStore.shared.save(event)
            state = .saved(event)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }

    func openCalendar(at date: Date) {
        let stamp = Int(date.timeIntervalSinceReferenceDate)
        guard let url = URL(string: "calshow:\(stamp)") else { return }
        UIApplication.shared.open(url)
    }
}
