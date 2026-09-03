import EventKit
import Foundation

enum CalendarStoreError: LocalizedError {
    case accessDenied
    case noCalendar

    var errorDescription: String? {
        switch self {
        case .accessDenied:
            return "Kalender-Zugriff wurde nicht erlaubt. Bitte in den iPhone-Einstellungen für VANTARO aktivieren."
        case .noCalendar:
            return "Kein Standardkalender gefunden."
        }
    }
}

final class CalendarStore {
    static let shared = CalendarStore()

    private let store = EKEventStore()

    func save(_ event: FollowUpEvent) async throws {
        try await requestAccess()

        let ekEvent = EKEvent(eventStore: store)
        ekEvent.title = event.title
        ekEvent.startDate = event.followUpAt
        ekEvent.endDate = event.followUpAt.addingTimeInterval(TimeInterval(max(event.durationMinutes, 1) * 60))
        ekEvent.notes = event.notes
        if let url = URL(string: event.leadUrl), !event.leadUrl.isEmpty {
            ekEvent.url = url
        }
        ekEvent.calendar = store.defaultCalendarForNewEvents
            ?? store.calendars(for: .event).first(where: { $0.allowsContentModifications })
        guard ekEvent.calendar != nil else {
            throw CalendarStoreError.noCalendar
        }
        ekEvent.addAlarm(EKAlarm(relativeOffset: 0))
        try store.save(ekEvent, span: .thisEvent, commit: true)
    }

    private func requestAccess() async throws {
        if #available(iOS 17.0, *) {
            let granted = try await store.requestWriteOnlyAccessToEvents()
            guard granted else { throw CalendarStoreError.accessDenied }
            return
        }

        let granted = try await store.requestAccess(to: .event)
        guard granted else { throw CalendarStoreError.accessDenied }
    }
}
