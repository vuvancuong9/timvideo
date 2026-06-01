import { Badge, Card, StatCard } from "@/components/ui";
import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  SOURCE_TYPE_LABELS,
  RISK_LABELS,
  RISK_COLORS,
  FINAL_ACTION_LABELS,
  FINAL_ACTION_COLORS,
  CONFIDENCE_LABELS,
  readRiskLevel,
  FINAL_ACTION_VERDICT,
  VERDICT_BG,
} from "@/lib/video-intake/labels";
import { getRiskGroups } from "@/lib/video-review/policy-groups-config";
import type { SubmissionWithRelations, ReviewBundle } from "@/lib/video-intake/queries";
import type { RiskLevel } from "@/types/videoReview";

/** Cảnh báo bắt buộc trên UI (spec §9). */
export function AiDisclaimer() {
  return (
    <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      ⚠️ Đây là hệ thống chấm điểm rủi ro bằng AI, không đảm bảo 100% quảng cáo
      sẽ được Meta/Facebook duyệt.
    </p>
  );
}

function jsonToStrings(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map((x) => (typeof x === "string" ? x : JSON.stringify(x)));
  }
  return [];
}

function RiskRow({ label, level }: { label: string; level: RiskLevel }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-1.5 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <Badge color={RISK_COLORS[level]}>{RISK_LABELS[level]}</Badge>
    </div>
  );
}

export async function ReviewResult({
  submission,
  bundle,
}: {
  submission: SubmissionWithRelations;
  bundle: ReviewBundle;
}) {
  const { analysis, policy, creative, decision, job } = bundle;
  const riskGroups = await getRiskGroups();

  return (
    <div className="space-y-6">
      <AiDisclaimer />

      {/* Header */}
      <Card>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
          <Info label="Tên sản phẩm">
            {submission.product_name || "—"}
          </Info>
          <Info label="Nguồn">
            {SOURCE_TYPE_LABELS[submission.source_type]}
          </Info>
          <Info label="Nhân viên">
            {submission.creator?.full_name ||
              submission.creator?.email ||
              "—"}
          </Info>
          <Info label="Ngày nhập">
            {formatDateTime(submission.created_at)}
          </Info>
          <Info label="Giá">{formatCurrency(submission.product_price)}</Info>
          <Info label="% hoa hồng">{submission.commission_percent}%</Info>
          <Info label="HH dự kiến">
            {formatCurrency(submission.estimated_commission)}
          </Info>
          <Info label="Sản phẩm Shopee">
            <a
              href={submission.shopee_product_url}
              target="_blank"
              rel="noreferrer"
              className="text-brand hover:underline"
            >
              Mở link
            </a>
          </Info>
          <Info label="Video gốc">
            {submission.original_video_url ? (
              <a
                href={submission.original_video_url}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline"
              >
                Mở link
              </a>
            ) : (
              "—"
            )}
          </Info>
          <Info label="Drive">
            {submission.drive_web_url ? (
              <a
                href={submission.drive_web_url}
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:underline"
              >
                Mở Drive
              </a>
            ) : (
              "—"
            )}
          </Info>
        </div>
      </Card>

      {/* Trạng thái job nếu chưa có kết quả */}
      {!decision && (
        <Card>
          <p className="text-sm text-gray-600">
            {job
              ? `Trạng thái xử lý: ${job.status} (stage: ${job.stage}).`
              : "Chưa có job xử lý."}
            {job?.error ? (
              <span className="mt-1 block text-red-600">Lỗi: {job.error}</span>
            ) : null}
          </p>
        </Card>
      )}

      {/* Score cards */}
      {decision && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Điểm bán hàng"
            value={creative ? Number(creative.creative_score).toFixed(0) : "—"}
          />
          <StatCard
            label="An toàn chính sách FB"
            value={
              policy ? Number(policy.policy_safety_score).toFixed(0) : "—"
            }
          />
          <StatCard
            label="An toàn bản quyền"
            value={
              policy ? Number(policy.copyright_safety_score).toFixed(0) : "—"
            }
          />
          <StatCard
            label="Điểm tổng"
            value={Number(decision.final_score).toFixed(0)}
          />
        </div>
      )}

      {decision && (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-600">
              Hành động đề xuất:
            </span>
            <Badge color={FINAL_ACTION_COLORS[decision.final_action]}>
              {FINAL_ACTION_LABELS[decision.final_action]}
            </Badge>
          </div>
          {decision.decision_reason && (
            <p className="mt-2 text-sm text-gray-600">
              {decision.decision_reason}
            </p>
          )}
          {jsonToStrings(decision.blocking_reasons).length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase text-gray-400">
                Lý do chặn
              </p>
              <ul className="list-inside list-disc text-sm text-red-600">
                {jsonToStrings(decision.blocking_reasons).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* Policy risk panel */}
      {policy && (
        <Card>
          <h2 className="mb-1 font-semibold text-gray-900">
            Khả năng vi phạm chính sách Facebook
          </h2>
          <p className="mb-3 text-xs text-gray-500">
            “An toàn” = ổn. “Cần lưu ý / Rủi ro cao / Rất nguy hiểm” = nên sửa
            hoặc bỏ. (Độ tin cậy: {CONFIDENCE_LABELS[policy.confidence]})
          </p>
          <div className="grid gap-x-8 md:grid-cols-2">
            {riskGroups.map((g) => (
              <RiskRow
                key={g.key}
                label={g.label_vi}
                level={readRiskLevel(policy.risk_scores, policy, g.key)}
              />
            ))}
          </div>

          {jsonToStrings(policy.risk_reasons).length > 0 && (
            <ListBlock
              title="Vì sao có rủi ro"
              items={jsonToStrings(policy.risk_reasons)}
            />
          )}
          {jsonToStrings(policy.suggested_fixes).length > 0 && (
            <ListBlock
              title="Cách sửa để an toàn hơn"
              items={jsonToStrings(policy.suggested_fixes)}
            />
          )}
        </Card>
      )}

      {/* Creative analysis */}
      {analysis && (
        <Card>
          <h2 className="mb-3 font-semibold text-gray-900">
            Phân tích video & gợi ý cải thiện (độ tin cậy:{" "}
            {CONFIDENCE_LABELS[analysis.confidence]})
          </h2>
          {analysis.hook_3s && (
            <Info label="3 giây đầu">{analysis.hook_3s}</Info>
          )}
          {analysis.summary && (
            <Info label="Tóm tắt">{analysis.summary}</Info>
          )}
          {analysis.product_detected && (
            <Info label="Sản phẩm nhận diện">
              {analysis.product_detected}
            </Info>
          )}
          <div className="mt-2 grid gap-x-8 md:grid-cols-2">
            <ListBlock
              title="Điểm mạnh"
              items={jsonToStrings(analysis.strong_scenes)}
            />
            <ListBlock
              title="Điểm yếu"
              items={jsonToStrings(analysis.weak_scenes)}
            />
            <ListBlock
              title="Ý tưởng làm lại"
              items={jsonToStrings(analysis.remake_angles)}
            />
          </div>
        </Card>
      )}

      {/* Creative suggestions */}
      {creative && (
        <Card>
          <h2 className="mb-3 font-semibold text-gray-900">Gợi ý sáng tạo</h2>
          <div className="grid gap-x-8 md:grid-cols-2">
            <ListBlock
              title="Tiêu đề gợi ý"
              items={jsonToStrings(creative.suggested_titles)}
            />
            <ListBlock
              title="Kịch bản gợi ý"
              items={jsonToStrings(creative.suggested_scripts)}
            />
            <ListBlock
              title="Chỉnh sửa gợi ý"
              items={jsonToStrings(creative.suggested_edits)}
            />
            <ListBlock
              title="Nhận xét"
              items={jsonToStrings(creative.reasons)}
            />
          </div>
        </Card>
      )}
    </div>
  );
}

function Info({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
      <div className="text-sm text-gray-800">{children}</div>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold uppercase text-gray-400">{title}</p>
      <ul className="list-inside list-disc text-sm text-gray-700">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
