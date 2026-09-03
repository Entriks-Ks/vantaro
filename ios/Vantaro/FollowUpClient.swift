import Foundation

final class FollowUpClient {
    static let shared = FollowUpClient()

    private let session: URLSession
    private let decoder: JSONDecoder

    init(session: URLSession = .shared) {
        self.session = session
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let value = try container.decode(String.self)
            let withFraction = ISO8601DateFormatter()
            withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = withFraction.date(from: value) {
                return date
            }
            let plain = ISO8601DateFormatter()
            plain.formatOptions = [.withInternetDateTime]
            if let date = plain.date(from: value) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Invalid ISO-8601 date: \(value)"
            )
        }
        self.decoder = decoder
    }

    func fetch(lead: String, at: String, sig: String) async throws -> FollowUpEvent {
        guard var components = URLComponents(string: "\(Self.apiBaseURL)/api/calendar/wiedervorlage.json") else {
            throw FollowUpAPIError.invalidURL
        }
        components.queryItems = [
            URLQueryItem(name: "lead", value: lead),
            URLQueryItem(name: "at", value: at),
            URLQueryItem(name: "sig", value: sig),
        ]
        guard let url = components.url else {
            throw FollowUpAPIError.invalidURL
        }

        let (data, response) = try await session.data(from: url)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 404 {
            throw FollowUpAPIError.notFound
        }
        if status >= 400 {
            let payload = try? decoder.decode(ErrorPayload.self, from: data)
            throw FollowUpAPIError.server(payload?.error ?? "Kalender-Eintrag konnte nicht geladen werden.")
        }

        do {
            return try decoder.decode(FollowUpEventResponse.self, from: data).event
        } catch {
            throw FollowUpAPIError.decode
        }
    }

    private static var apiBaseURL: String {
        let raw = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String
        let value = raw?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return value.isEmpty ? "https://vantaro.onrender.com" : value.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    }
}

private struct ErrorPayload: Decodable {
    let error: String
}
