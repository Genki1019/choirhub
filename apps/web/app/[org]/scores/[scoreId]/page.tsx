"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, FileText, Music2, EyeOff, Tag, Pencil,
  Loader2, AlertCircle, Users, FolderOpen, BookOpen, CheckCircle2,
} from "lucide-react";
import { scoresApi, type ScoreDetail, type ScoreFile, type ScoreMetaResponse } from "@/lib/scores-api";
import { membersApi, type PartSummary } from "@/lib/members-api";
import { useMember } from "@/contexts/MemberContext";
import { settingsApi, type MemberType } from "@/lib/settings-api";
import { ApiClientError } from "@/lib/api-client";
import { MEMBER_LEVEL_ROLES } from "@/lib/roles";
import { MidiModal } from "../_components/MidiModal";
import { PurchaseModal } from "../_components/PurchaseModal";
import { FileManageModal } from "../_components/FileManageModal";
import { CollectionModal } from "../../accounting/_components/CollectionModal";
import { ScoreFormModal } from "../_components/ScoreFormModal";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function ScoreDetailPage() {
  const { org, scoreId } = useParams<{ org: string; scoreId: string }>();
  const router = useRouter();

  const { roles: myRoles } = useMember();
  const [score, setScore] = useState<ScoreDetail | null>(null);
  const [parts, setParts] = useState<PartSummary[]>([]);
  const [memberTypes, setMemberTypes] = useState<MemberType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showMidi,       setShowMidi]       = useState(false);
  const [showPurchase,   setShowPurchase]   = useState(false);
  const [showFileManage, setShowFileManage] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [showEdit,       setShowEdit]       = useState(false);
  const [editingPrice,   setEditingPrice]   = useState(false);
  const [priceInput,     setPriceInput]     = useState("");
  const [savingPrice,    setSavingPrice]    = useState(false);
  const savingPriceRef = useRef(false);

  const isAdmin       = myRoles.includes("admin");
  const isPrivileged  = isAdmin || myRoles.includes("score");
  const canManageMidi = isAdmin || myRoles.includes("tech") || myRoles.includes("conductor");
  const isFileManager = isPrivileged || canManageMidi;
  const canViewPrice  = myRoles.some((r) => MEMBER_LEVEL_ROLES.has(r));

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      scoresApi.getDetail(org, scoreId),
      membersApi.parts(org),
      settingsApi.listMemberTypes(org),
    ])
      .then(([scoreData, partData, types]) => {
        setScore(scoreData);
        setParts(partData);
        setMemberTypes(types);
        setError(null);
      })
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 401) { router.push("/login"); return; }
        setError(err instanceof Error ? err.message : "データの取得に失敗しました");
      })
      .finally(() => setLoading(false));
  }, [org, scoreId, router]);

  useEffect(() => { load(); }, [load]);

  const startEditPrice = () => {
    if (!score) return;
    setPriceInput(score.distributionPrice !== null ? String(score.distributionPrice) : "");
    setEditingPrice(true);
  };

  const savePrice = async () => {
    if (savingPriceRef.current || !score) return;
    const trimmed = priceInput.trim();
    const parsed = trimmed === "" ? null : parseInt(trimmed, 10);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) { setEditingPrice(false); return; }
    if (parsed === score.distributionPrice) { setEditingPrice(false); return; }
    savingPriceRef.current = true;
    setSavingPrice(true);
    try {
      await scoresApi.setPrice(org, score.id, parsed);
      setScore((s) => s ? { ...s, distributionPrice: parsed } : s);
      setEditingPrice(false);
    } catch {
      setEditingPrice(false);
    } finally {
      savingPriceRef.current = false;
      setSavingPrice(false);
    }
  };

  const handleFilesUpdated = (updatedFiles: ScoreFile[]) => {
    setScore((s) => s ? { ...s, files: updatedFiles } : s);
    setShowFileManage(false);
  };

  const handleMetaSaved = (updated: ScoreMetaResponse) => {
    setScore((s) => s ? { ...s, ...updated } : s);
    setShowEdit(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (error || !score) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-500 bg-red-50 border border-red-200 rounded-xl px-5 py-4">
          <AlertCircle size={16} />
          <span className="text-sm">{error ?? "楽譜が見つかりません"}</span>
        </div>
      </div>
    );
  }

  const scoreFile = score.files.find((f) => f.fileType === "full_score");
  const midiFiles = score.files.filter((f) => f.fileType === "midi");

  const hasMetadata = score.isCommissioned || score.purchaseDate || score.distributionStart
    || canViewPrice || score.notes
    || (isPrivileged && score.purchasePrice != null);

  return (
    <div className="flex flex-col">
      <header className="bg-white border-b border-gray-200 shrink-0">
        <PageBleedRow className="flex items-center gap-3 py-4">
          <Link href={`/${org}/scores`} className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-gray-800 truncate">{score.title}</h1>
            {(score.composer || score.arranger) && (
              <p className="text-xs text-gray-400 mt-0.5">
                {[
                  score.composer ? `${score.composer} 作曲` : null,
                  score.arranger ? `${score.arranger} 編曲` : null,
                ].filter(Boolean).join(" / ")}
              </p>
            )}
          </div>
          {isPrivileged && (
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 border border-gray-200 hover:border-brand-300 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Pencil size={13} />
              編集
            </button>
          )}
        </PageBleedRow>
      </header>

      <PageMain className="space-y-4">
        {/* ── ファイル ── */}
        <section className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">ファイル</h2>
          {!score.canAccessFiles ? (
            <p className="text-sm text-gray-400 flex items-center gap-1.5">
              <EyeOff size={13} />
              {score.accessLevel === "secret" ? "閲覧制限されています" : "楽譜を購入すると閲覧できます"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {scoreFile ? (
                <a
                  href={`/${org}/scores/${score.id}/files/${scoreFile.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-brand-50 text-brand-700 border border-brand-200 hover:bg-brand-100 transition-colors font-medium"
                >
                  <FileText size={13} />
                  楽譜PDF
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gray-50 text-gray-400 border border-gray-200 font-medium">
                  <FileText size={13} />
                  楽譜未登録
                </span>
              )}

              {score.canDownload && (
                midiFiles.length > 0 ? (
                  <button
                    onClick={() => setShowMidi(true)}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors font-medium"
                  >
                    <Music2 size={13} />
                    MIDI <span className="text-purple-400 font-normal">{midiFiles.length}件</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gray-50 text-gray-400 border border-gray-200 font-medium">
                    <Music2 size={13} />
                    MIDI未登録
                  </span>
                )
              )}
            </div>
          )}
        </section>

        {/* ── 詳細情報 ── */}
        <section className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">詳細情報</h2>
          {hasMetadata ? (
            <dl className="space-y-2">
              {score.isCommissioned && (
                <div className="flex gap-3">
                  <dt className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">委嘱</dt>
                  <dd className="text-sm text-gray-700">委嘱作品</dd>
                </div>
              )}
              {score.purchaseDate && (
                <div className="flex gap-3">
                  <dt className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">購入日</dt>
                  <dd className="text-sm text-gray-700">{score.purchaseDate}</dd>
                </div>
              )}
              {score.distributionStart && (
                <div className="flex gap-3">
                  <dt className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">配布開始日</dt>
                  <dd className="text-sm text-gray-700">{score.distributionStart}</dd>
                </div>
              )}
              {canViewPrice && (
                <div className="flex gap-3 items-center">
                  <dt className="text-xs text-gray-400 w-24 shrink-0">配布価格</dt>
                  <dd>
                    {editingPrice ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-500">¥</span>
                        <input
                          type="number"
                          min="0"
                          value={priceInput}
                          onChange={(e) => setPriceInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") savePrice();
                            if (e.key === "Escape") setEditingPrice(false);
                          }}
                          onBlur={savePrice}
                          className="w-24 border border-gray-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                          autoFocus
                          placeholder="例: 300"
                        />
                        {savingPrice && <Loader2 size={11} className="animate-spin text-gray-400" />}
                      </div>
                    ) : score.distributionPrice !== null ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <Tag size={10} />
                          ¥{score.distributionPrice.toLocaleString()}
                        </span>
                        {isPrivileged && (
                          <button onClick={startEditPrice} className="p-0.5 text-gray-400 hover:text-brand-500 transition-colors rounded" title="価格を変更">
                            <Pencil size={10} />
                          </button>
                        )}
                      </div>
                    ) : isPrivileged ? (
                      <button onClick={startEditPrice} className="text-xs text-gray-400 hover:text-brand-500 transition-colors">
                        + 価格を設定
                      </button>
                    ) : (
                      <span className="text-sm text-gray-400">未設定</span>
                    )}
                  </dd>
                </div>
              )}
              {isPrivileged && score.purchasePrice != null && (
                <div className="flex gap-3">
                  <dt className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">仕入価格</dt>
                  <dd className="text-sm text-gray-700">¥{score.purchasePrice.toLocaleString()}</dd>
                </div>
              )}
              {isPrivileged && score.purchaseCount !== undefined && (
                <div className="flex gap-3 items-center">
                  <dt className="text-xs text-gray-400 w-24 shrink-0">購入者</dt>
                  <dd className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{score.purchaseCount}名</span>
                    <button
                      onClick={() => setShowPurchase(true)}
                      className="inline-flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 hover:underline transition-colors"
                    >
                      <Users size={10} />
                      管理
                    </button>
                  </dd>
                </div>
              )}
              {score.notes && (
                <div className="flex gap-3">
                  <dt className="text-xs text-gray-400 w-24 shrink-0 pt-0.5">備考</dt>
                  <dd className="text-sm text-gray-700 whitespace-pre-wrap">{score.notes}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">詳細情報はありません</p>
          )}
        </section>

        {/* ── 管理 ── */}
        {isFileManager && (
          <section className="bg-white rounded-xl border border-gray-200 px-5 py-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">管理</h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowFileManage(true)}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors font-medium"
              >
                <FolderOpen size={13} />
                ファイル管理
              </button>
              {isPrivileged && (
                score.hasCollection ? (
                  <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-green-50 text-green-600 border border-green-200 font-medium cursor-default">
                    <CheckCircle2 size={13} />
                    徴収作成済み
                  </span>
                ) : score.distributionPrice !== null ? (
                  <button
                    onClick={() => setShowCollection(true)}
                    className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors font-medium"
                  >
                    <BookOpen size={13} />
                    + 徴収を作成
                  </button>
                ) : null
              )}
            </div>
          </section>
        )}
      </PageMain>

      {showMidi && (
        <MidiModal score={score} onClose={() => setShowMidi(false)} />
      )}

      {showPurchase && (
        <PurchaseModal
          orgSlug={org}
          score={score}
          onClose={() => { setShowPurchase(false); load(); }}
        />
      )}

      {showFileManage && (
        <FileManageModal
          orgSlug={org}
          score={score}
          parts={parts}
          canManagePdf={isPrivileged}
          canManageMidi={canManageMidi}
          onClose={handleFilesUpdated}
        />
      )}

      {showCollection && (
        <CollectionModal
          org={org}
          memberTypes={memberTypes}
          initialTitle={score.title}
          initialAmount={score.distributionPrice ?? undefined}
          scoreId={score.id}
          onClose={() => setShowCollection(false)}
          onSaved={() => {
            setShowCollection(false);
            setScore((s) => s ? { ...s, hasCollection: true } : s);
          }}
        />
      )}

      {showEdit && (
        <ScoreFormModal
          mode="edit"
          orgSlug={org}
          score={score}
          isAdmin={isAdmin}
          onClose={() => setShowEdit(false)}
          onSaved={handleMetaSaved}
        />
      )}
    </div>
  );
}
