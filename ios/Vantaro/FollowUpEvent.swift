import Foundation

struct FollowUpEvent: Decodable, Equatable {
    let leadId: String
    let leadName: String
    let title: String
    let followUpAt: Date
    let durationMinutes: Int
    let phone: String
    let leadUrl: String
    let notes: String
}

struct FollowUpEventResponse: Decodable {
    let event: FollowUpEvent
}

enum FollowUpAPIError: LocalizedError {
    case invalidURL
    case notFound
    case server(String)
    case decode

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "API-Adresse ist ungültig."
        case .notFound:
            return "Kalender-Eintrag wurde nicht gefunden."
        case .server(let message):
            return message
        case .decode:
            return "Kalender-Eintrag konnte nicht gelesen werden."
        }
    }
}
