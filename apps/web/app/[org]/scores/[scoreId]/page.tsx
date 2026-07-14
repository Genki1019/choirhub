"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Music2,
  EyeOff,
  Tag,
  Pencil,
  Loader2,
  AlertCircle,
  Users,
  FolderOpen,
  BookOpen,
  CheckCircle2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { scoresApi, type ScoreDetail } from "@/lib/scores-api";
import { membersApi } from "@/lib/members-api";
import { useMember } from "@/contexts/MemberContext";
import { settingsApi } from "@/lib/settings-api";
import { MEMBER_LEVEL_ROLES } from "@/lib/roles";
import { scoresKeys, memberKeys } from "@/lib/query-keys";
import { MidiModal } from "../_components/MidiModal";
import { PurchaseModal } from "../_components/PurchaseModal";
import { FileManageModal } from "../_components/FileManageModal";
import { CollectionModal } from "../../accounting/_components/CollectionModal";
import { ScoreFormModal } from "../_components/ScoreFormModal";
import { PageMain } from "@/components/PageMain";
import { PageBleedRow } from "@/components/PageBleedRow";

export default function ScoreDetailPage() {
  const { org, scoreId } = useParams<{ org: string; scoreId: string }>();
  const queryClient = useQueryClient();
  const patchScore = (patch: Partial<ScoreDetail>) =>
    queryClient.setQueryData<ScoreDetail>(scoresKeys.detail(org, scoreId), (prev) =>
      prev ? { ...prev, ...patch } : prev,
    );

  const { roles: myRoles } = useMember();

  const [showMidi, setShowMidi] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showFileManage, setShowFileManage] = useState(false);
  const [showCollection, setShowCollection] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const savingPriceRef = useRef(false);

  const isAdmin = myRoles.includes("admin");
  const isPrivileged = isAdmin || myRoles.includes("score");
  const canManageMidi = isAdmin || myRoles.includes("tech") || myRoles.includes("conductor");
  const isFileManager = isPrivileged || canManageMidi;
  const canViewPrice = myRoles.some((r) => MEMBER_LEVEL_ROLES.has(r));

  const {
    data: score,
    isLoading: loading,
    error: scoreError,
  } = useQuery({
    queryKey: scoresKeys.detail(org, scoreId),
    queryFn: () => scoresApi.getDetail(org, scoreId),
  });

  const { data: parts = [] } = useQuery({
    queryKey: memberKeys.parts(org),
    queryFn: () => membersApi.parts(org),
    enabled: showFileManage,
  });

  const { data: memberTypes = [] } = useQuery({
    queryKey: memberKeys.types(org),
    queryFn: () => settingsApi.listMemberTypes(org),
    enabled: showCollection,
  });

  const startEditPrice = () => {
    if (!score) return;
    setPriceInput(score.distributionPrice !== null ? String(score.distributionPrice) : "");
    setEditingPrice(true);
  };

  const savePrice = async () => {
    if (savingPriceRef.current || !score) return;
    const trimmed = priceInput.trim();
    const parsed = trimmed === "" ? null : parseInt(trimmed, 10);
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) {
      setEditingPrice(false);
      return;
    }
    if (parsed === score.distributionPrice) {
      setEditingPrice(false);
      return;
    }
    savingPriceRef.current = true;
    setSavingPrice(true);
    try {
      await scoresApi.setPrice(org, score.id, parsed);
      patchScore({ distributionPrice: parsed });
      setEditingPrice(false);
    } catch {
      setEditingPrice(false);
    } finally {
      savingPriceRef.current = false;
      setSavingPrice(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">読み込み中...</span>
      </div>
    );
  }

  if (scoreError || !score) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-500">
          <AlertCircle size={16} />
          <span className="text-sm">{scoreError?.message ?? "楽譜が見つかりません"}</span>
        </div>
      </div>
    );
  }

  const scoreFile = score.files.find((f) => f.fileType === "full_score");
  const midiFiles = score.files.filter((f) => f.fileType === "midi");

  const hasMetadata =
    score.isCommissioned ||
    score.purchaseDate ||
    score.distributionStart ||
    canViewPrice ||
    score.notes ||
    (isPrivileged && score.purchasePrice != null);

  return (
    <div className="flex flex-col">
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <PageBleedRow className="flex items-center gap-3 py-4">
          <Link
            href={`/${org}/scores`}
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold text-gray-800">{score.title}</h1>
            {(score.composer || score.arranger) && (
              <p className="mt-0.5 text-xs text-gray-400">
                {[
                  score.composer ? `${score.composer} 作曲` : null,
                  score.arranger ? `${score.arranger} 編曲` : null,
                ]
                  .filter(Boolean)
                  .join(" / ")}
              </p>
            )}
          </div>
          {isPrivileged && (
            <button
              onClick={() => setShowEdit(true)}
              className="hover:text-brand-600 hover:border-brand-300 flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-500 transition-colors"
            >
              <Pencil size={13} />
              編集
            </button>
          )}
        </PageBleedRow>
      </header>

      <PageMain className="space-y-4">
        {/* ── ファイル ── */}
        <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            ファイル
          </h2>
          {!score.canAccessFiles ? (
            <p className="flex items-center gap-1.5 text-sm text-gray-400">
              <EyeOff size={13} />
              {score.accessLevel === "secret"
                ? "閲覧制限されています"
                : "楽譜を購入すると閲覧できます"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {scoreFile ? (
                <a
                  href={`/${org}/scores/${score.id}/files/${scoreFile.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-brand-50 text-brand-700 border-brand-200 hover:bg-brand-100 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
                >
                  <FileText size={13} />
                  楽譜PDF
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-400">
                  <FileText size={13} />
                  楽譜未登録
                </span>
              )}

              {score.canDownload &&
                (midiFiles.length > 0 ? (
                  <button
                    onClick={() => setShowMidi(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-100"
                  >
                    <Music2 size={13} />
                    MIDI <span className="font-normal text-purple-400">{midiFiles.length}件</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-400">
                    <Music2 size={13} />
                    MIDI未登録
                  </span>
                ))}
            </div>
          )}
        </section>

        {/* ── 詳細情報 ── */}
        <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
          <h2 className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
            詳細情報
          </h2>
          {hasMetadata ? (
            <dl className="space-y-2">
              {score.isCommissioned && (
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 pt-0.5 text-xs text-gray-400">委嘱</dt>
                  <dd className="text-sm text-gray-700">委嘱作品</dd>
                </div>
              )}
              {score.purchaseDate && (
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 pt-0.5 text-xs text-gray-400">購入日</dt>
                  <dd className="text-sm text-gray-700">{score.purchaseDate}</dd>
                </div>
              )}
              {score.distributionStart && (
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 pt-0.5 text-xs text-gray-400">配布開始日</dt>
                  <dd className="text-sm text-gray-700">{score.distributionStart}</dd>
                </div>
              )}
              {canViewPrice && (
                <div className="flex items-center gap-3">
                  <dt className="w-24 shrink-0 text-xs text-gray-400">配布価格</dt>
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
                          className="focus:ring-brand-400 w-24 rounded border border-gray-200 px-1.5 py-0.5 text-xs focus:ring-1 focus:outline-none"
                          autoFocus
                          placeholder="例: 300"
                        />
                        {savingPrice && (
                          <Loader2 size={11} className="animate-spin text-gray-400" />
                        )}
                      </div>
                    ) : score.distributionPrice !== null ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                          <Tag size={10} />¥{score.distributionPrice.toLocaleString()}
                        </span>
                        {isPrivileged && (
                          <button
                            onClick={startEditPrice}
                            className="hover:text-brand-500 rounded p-0.5 text-gray-400 transition-colors"
                            title="価格を変更"
                          >
                            <Pencil size={10} />
                          </button>
                        )}
                      </div>
                    ) : isPrivileged ? (
                      <button
                        onClick={startEditPrice}
                        className="hover:text-brand-500 text-xs text-gray-400 transition-colors"
                      >
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
                  <dt className="w-24 shrink-0 pt-0.5 text-xs text-gray-400">仕入価格</dt>
                  <dd className="text-sm text-gray-700">¥{score.purchasePrice.toLocaleString()}</dd>
                </div>
              )}
              {isPrivileged && score.purchaseCount !== undefined && (
                <div className="flex items-center gap-3">
                  <dt className="w-24 shrink-0 text-xs text-gray-400">購入者</dt>
                  <dd className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">{score.purchaseCount}名</span>
                    <button
                      onClick={() => setShowPurchase(true)}
                      className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 text-xs transition-colors hover:underline"
                    >
                      <Users size={10} />
                      管理
                    </button>
                  </dd>
                </div>
              )}
              {score.notes && (
                <div className="flex gap-3">
                  <dt className="w-24 shrink-0 pt-0.5 text-xs text-gray-400">備考</dt>
                  <dd className="text-sm whitespace-pre-wrap text-gray-700">{score.notes}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-400">詳細情報はありません</p>
          )}
        </section>

        {/* ── 管理 ── */}
        {isFileManager && (
          <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
            <h2 className="mb-3 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              管理
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowFileManage(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
              >
                <FolderOpen size={13} />
                ファイル管理
              </button>
              {isPrivileged &&
                (score.hasCollection ? (
                  <span className="inline-flex cursor-default items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-600">
                    <CheckCircle2 size={13} />
                    徴収作成済み
                  </span>
                ) : score.distributionPrice !== null ? (
                  <button
                    onClick={() => setShowCollection(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
                  >
                    <BookOpen size={13} />+ 徴収を作成
                  </button>
                ) : null)}
            </div>
          </section>
        )}
      </PageMain>

      {showMidi && <MidiModal score={score} onClose={() => setShowMidi(false)} />}

      {showPurchase && (
        <PurchaseModal
          orgSlug={org}
          score={score}
          onClose={() => {
            setShowPurchase(false);
            queryClient.invalidateQueries({ queryKey: scoresKeys.detail(org, scoreId) });
          }}
        />
      )}

      {showFileManage && (
        <FileManageModal
          orgSlug={org}
          score={score}
          parts={parts}
          canManagePdf={isPrivileged}
          canManageMidi={canManageMidi}
          onClose={(files) => {
            patchScore({ files });
            setShowFileManage(false);
          }}
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
            patchScore({ hasCollection: true });
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
          onSaved={(updated) => {
            patchScore(updated as Partial<ScoreDetail>);
            setShowEdit(false);
          }}
        />
      )}
    </div>
  );
}
