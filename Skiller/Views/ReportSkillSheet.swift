import SwiftUI

struct ReportSkillSheet: View {
    let skill: Skill
    @EnvironmentObject private var auth: AuthService
    @Environment(\.dismiss) private var dismiss

    enum Reason: String, CaseIterable, Hashable {
        case abuse, copyright, malicious, spam, other

        var label: String {
            switch self {
            case .abuse:     return "违规内容（色情 / 暴力 / 歧视）"
            case .copyright: return "版权侵犯"
            case .malicious: return "恶意代码"
            case .spam:      return "垃圾或低质量内容"
            case .other:     return "其他"
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
            .navigationTitle("举报")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(Color.bg, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("关闭") { dismiss() }
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
                                Text("提交").fontWeight(.semibold)
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
            Text("收到举报后我们会人工复核，必要时下架内容。")
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
            Text("举报原因")
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
            Text("补充说明（可选）")
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
            Text("已提交")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Color.textPrimary)
            Text("感谢反馈，我们会尽快人工复核。")
                .font(.system(size: 12))
                .foregroundStyle(Color.textSubtle)
                .multilineTextAlignment(.center)
            Button("关闭") { dismiss() }
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
                reason: reason.label,
                note: trimmed.isEmpty ? nil : trimmed,
                userId: userId
            )
            submitted = true
        } catch {
            print("Report failed: \(error)")
            self.error = "提交失败，请稍后重试"
        }
        submitting = false
    }
}
