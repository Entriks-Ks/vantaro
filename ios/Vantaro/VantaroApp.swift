import SwiftUI

@main
struct VantaroApp: App {
    @StateObject private var session = FollowUpSession()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(session)
        }
    }
}
