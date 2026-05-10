import SwiftUI

struct ReportSkillSheet: View {
    let skill: Skill
    @EnvironmentObject private var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    enum Reason: String, CaseIterable, Hashable {
        case abuse, copyright, malicious, spam, other

        var label: LocalizedStringKey {
            switch self {
            case .abuse:     return "Inappropriate content (sexual / violence / discrimination)"
            case .copyright: return "Copyright infringement"
            case .malicious: return "Malicious code"
            case .spam:      return "Spam or low-quality content"
            case .other:     return "Other"
            }
        }

        /// Stable English label sent to the backend (so reports remain searchable
        /// regardless of the reporter's UI language).
        var apiLabel: String {
            switch self {
            case .abuse:     return "Inappropriate content (sexual / violence / discrimination)"
            case .copyright: return "Copyright infringement"
            case .malicious: return "Malicious code"
            case .spam:      return "Spam or low-quality content"
            case .other:     return "Other"
            }
        }
    }

    @State private var reason: Reason = .abuse
    @State private var note: String = ""
    @State private var submitting = false
    @State private var submitted = false
    @State private var error: String? = nil

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    intro
                    if submitted {
                        successCard
                    } else {
                        reasonList
                        noteField
                        if let msg = error {
                            Text(msg)
                                .font(.system(size: 12))
                                .foregroundStyle(.red)
                        }
                    }
                }
                .padding(16)
            }
            .scrollIndicators(.hidden)
            .background(Color.bg.ignoresSafeArea())
            .navigationTitle("Report")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bg, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Close") { dismiss() }
                        .tint(Color.textSubtle)
                }
                if !submitted {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            Task { await submit() }
                        } label: {
                            if submitting {
                                ProgressView().tint(Color.brand)
                            } else {
                                Text("Submit").fontWeight(.semibold)
                            }
                        }
                        .tint(Color.brand)
                        .disabled(submitting)
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(skill.name)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)
            Text("We'll manually review reports and remove content when needed.")
                .font(.system(size: 12))
                .foregroundStyle(Color.textSubtle)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.bgCard)
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.borderSubtle, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var reasonList: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Report Reason")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.textSubtle)
                .tracking(1.2)
                .textCase(.uppercase)
            VStack(spacing: 0) {
                ForEach(Array(Reason.allCases.enumerated()), id: \.element) { idx, r in
                    if idx > 0 {
                        Rectangle().fill(Color.borderSubtle).frame(height: 1).padding(.leading, 14)
                    }
                    Button { reason = r } label: {
                        HStack {
                            Text(r.label)
                                .font(.system(size: 14))
                                .foregroundStyle(Color.textPrimary)
                            Spacer()
                            if reason == r {
                                Image(systemName: "checkmark")
                                    .font(.system(size: 13, weight: .semibold))
                                    .foregroundStyle(Color.brand)
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .background(Color.bgCard)
            .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.borderSubtle, lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
    }

    private var noteField: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Additional Notes (Optional)")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.textSubtle)
                .tracking(1.2)
                .textCase(.uppercase)
            TextEditor(text: $note)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 100)
                .padding(10)
                .background(Color.bgCard)
                .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.borderSubtle, lineWidth: 1))
                .clipShape(RoundedRectangle(cornerRadius: 14))
                .font(.system(size: 14))
                .foregroundStyle(Color.textPrimary)
        }
    }

    private var successCard: some View {
        VStack(spacing: 10) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 32))
                .foregroundStyle(Color.accentGreen)
            Text("Submitted")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.textPrimary)
            Text("Thanks for the feedback. We'll review it as soon as possible.")
                .font(.system(size: 12))
                .foregroundStyle(Color.textSubtle)
                .multilineTextAlignment(.center)
            Button("Close") { dismiss() }
                .tint(Color.brand)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
        .padding(.horizontal, 16)
        .background(Color.bgCard)
        .overlay(RoundedRectangle(cornerRadius: 14).strokeBorder(Color.borderSubtle, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    @MainActor
    private func submit() async {
        submitting = true
        error = nil
        let userId: UUID? = {
            if case .signedIn(let id) = auth.state { return id.userId }
            return nil
        }()
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try await SkillsAPI.submitReport(
                skillId: skill.id,
                skillSlug: skill.slug,
                skillName: skill.name,
                reason: reason.apiLabel,
                note: trimmed.isEmpty ? nil : trimmed,
                userId: userId
            )
            submitted = true
        } catch {
            print("Report failed: \(error)")
            self.error = String(localized: "Submission failed, please try again later")
        }
        submitting = false
    }
}
