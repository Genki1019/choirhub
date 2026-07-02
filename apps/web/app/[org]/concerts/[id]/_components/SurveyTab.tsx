"use client";

import { useState, useEffect } from "react";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import {
  concertsApi,
  type ConcertDetail,
  type AttendanceStatus,
  type ConcertStatus,
  type SurveyDetail,
  type SurveySummary,
} from "@/lib/concerts-api";
import { CreateSurveyModal } from "./CreateSurveyModal";

function buildStateMap(rows: SurveyDetail["rows"]): Map<string, Map<string, AttendanceStatus>> {
  const m = new Map<string, Map<string, AttendanceStatus>>();
  rows.forEach((r) => {
    const sm = new Map<string, AttendanceStatus>();
    r.stages.forEach((s) => sm.set(s.stageId, s.status));
    m.set(r.memberId, sm);
  });
  return m;
}

const SURVEY_STATUS_CONFIG: Record<AttendanceStatus, {
  symbol: string; label: string;
  badgeClass: string; cellClass: string;
}> = {
  attending: { symbol: "○", label: "参加",   badgeClass: "text-green-600 font-bold", cellClass: "bg-green-50" },
  maybe:     { symbol: "△", label: "未定",   badgeClass: "text-amber-500 font-bold", cellClass: "bg-amber-50" },
  absent:    { symbol: "✕", label: "不参加", badgeClass: "text-red-500  font-bold", cellClass: "bg-red-50" },
  undecided: { symbol: "—", label: "未回答", badgeClass: "text-gray-400",            cellClass: "bg-gray-50" },
};

const STATUS_CYCLE: AttendanceStatus[] = ["attending", "absent", "maybe", "undecided"];

interface SurveyTabProps {
  concert: ConcertDetail;
  org: string;
  isAdmin: boolean;
  myMemberId: string;
  onSurveysChanged: (surveys: SurveySummary[]) => void;
  onConcertStatusChanged: (status: ConcertStatus) => void;
}

export function SurveyTab({
  concert, org, isAdmin, onSurveysChanged, onConcertStatusChanged, myMemberId,
}: SurveyTabProps) {
  const surveys = concert.surveys;

  const [selectedSurveyId, setSelectedSurveyId] = useState<string | null>(() =>
    surveys.find((s) => s.isOpen)?.id ?? surveys[0]?.id ?? null
  );
  const [surveyDetail, setSurveyDetail] = useState<SurveyDetail | null>(null);
  const [loadedForId,  setLoadedForId]  = useState<string | null>(null);

  const [stateMap,        setStateMap]        = useState<Map<string, Map<string, AttendanceStatus>>>(() => buildStateMap([]));
  const [memoMap,         setMemoMap]         = useState<Map<string, string>>(() => new Map());
  const [saving,          setSaving]          = useState<string | null>(null);
  const [savingMemo,      setSavingMemo]      = useState<string | null>(null);
  const [toggling,        setToggling]        = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadingDetail    = selectedSurveyId !== null && loadedForId !== selectedSurveyId;
  const activeSurveyDetail = selectedSurveyId !== null && loadedForId === selectedSurveyId ? surveyDetail : null;

  useEffect(() => {
    if (!selectedSurveyId) return;
    const id = selectedSurveyId;
    let cancelled = false;
    concertsApi.getSurveyDetail(org, concert.id, id)
      .then((detail) => {
        if (cancelled) return;
        setSurveyDetail(detail);
        setStateMap(buildStateMap(detail.rows));
        const m = new Map<string, string>();
        detail.rows.forEach((r) => { if (r.memo) m.set(r.memberId, r.memo); });
        setMemoMap(m);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadedForId(id); });
    return () => { cancelled = true; };
  }, [selectedSurveyId, org, concert.id]);

  const canEdit = (rowMemberId: string) => isAdmin || rowMemberId === myMemberId;

  const handleCellClick = async (rowMemberId: string, stageId: string) => {
    if (!activeSurveyDetail || !selectedSurveyId || !canEdit(rowMemberId)) return;
    if (!activeSurveyDetail.isOpen && !isAdmin) return;

    const key = `${rowMemberId}:${stageId}`;
    if (saving === key) return;

    const prevStatus = stateMap.get(rowMemberId)?.get(stageId) ?? "undecided";
    const nextStatus = STATUS_CYCLE[(STATUS_CYCLE.indexOf(prevStatus) + 1) % STATUS_CYCLE.length];

    setStateMap((prev) => {
      const next = new Map(prev);
      const inner = new Map(next.get(rowMemberId) ?? []);
      inner.set(stageId, nextStatus);
      next.set(rowMemberId, inner);
      return next;
    });
    setSaving(key);

    try {
      await concertsApi.respondSurvey(
        org, concert.id, selectedSurveyId,
        [{ stageId, status: nextStatus }],
        undefined,
        rowMemberId !== myMemberId ? rowMemberId : undefined,
      );
    } catch {
      setStateMap((prev) => {
        const next = new Map(prev);
        const inner = new Map(next.get(rowMemberId) ?? []);
        inner.set(stageId, prevStatus);
        next.set(rowMemberId, inner);
        return next;
      });
    } finally {
      setSaving(null);
    }
  };

  const handleMemoBlur = async (rowMemberId: string, memo: string) => {
    if (!activeSurveyDetail || !selectedSurveyId || !canEdit(rowMemberId)) return;
    setSavingMemo(rowMemberId);
    const allStages = concert.stages.map((s) => ({
      stageId: s.id,
      status:  stateMap.get(rowMemberId)?.get(s.id) ?? "undecided",
    }));
    try {
      await concertsApi.respondSurvey(
        org, concert.id, selectedSurveyId,
        allStages, memo || null,
        rowMemberId !== myMemberId ? rowMemberId : undefined,
      );
    } finally {
      setSavingMemo(null);
    }
  };

  const handleToggle = async () => {
    if (!activeSurveyDetail || !selectedSurveyId || toggling) return;
    setToggling(true);
    try {
      const result = await concertsApi.patchSurvey(org, concert.id, selectedSurveyId, { isOpen: !activeSurveyDetail.isOpen });
      setSurveyDetail((prev) => prev ? { ...prev, isOpen: result.isOpen } : prev);
      onSurveysChanged(surveys.map((s) =>
        s.id === selectedSurveyId
          ? { ...s, isOpen: result.isOpen }
          : result.isOpen ? { ...s, isOpen: false } : s
      ));
      onConcertStatusChanged(result.concertStatus);
    } finally {
      setToggling(false);
    }
  };

  const handleSurveyCreated = (newSurvey: SurveySummary) => {
    onSurveysChanged([
      newSurvey,
      ...surveys.map((s) => (s.isOpen ? { ...s, isOpen: false } : s)),
    ]);
    onConcertStatusChanged("survey_open");
    setSelectedSurveyId(newSurvey.id);
    setShowCreateModal(false);
  };

  if (surveys.length === 0) {
    return (
      <>
        <div className="text-center py-12 text-gray-400">
          <ClipboardList size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">オンステ調査はまだ開設されていません</p>
          {isAdmin && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 flex items-center gap-1.5 mx-auto bg-brand-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors"
            >
              <Plus size={14} />
              調査を開設する
            </button>
          )}
        </div>
        {showCreateModal && (
          <CreateSurveyModal
            orgSlug={org}
            concertId={concert.id}
            surveyCount={surveys.length}
            onClose={() => setShowCreateModal(false)}
            onCreated={handleSurveyCreated}
          />
        )}
      </>
    );
  }

  const stages = concert.stages;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        {surveys.map((s) => (
          <button
            key={s.id}
            onClick={() => setSelectedSurveyId(s.id)}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
              selectedSurveyId === s.id
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-brand-300 hover:text-brand-600",
            ].join(" ")}
          >
            {s.title}
            <span className={[
              "px-1.5 py-0.5 rounded-full text-[10px]",
              selectedSurveyId === s.id
                ? s.isOpen ? "bg-green-400 text-white" : "bg-brand-400 text-white"
                : s.isOpen ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500",
            ].join(" ")}>
              {s.isOpen ? "受付中" : "締切"}
            </span>
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-400 border border-dashed border-gray-200 hover:border-brand-300 hover:text-brand-500 transition-colors"
          >
            <Plus size={12} />
            新しい調査
          </button>
        )}
      </div>

      {loadingDetail && (
        <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">読み込み中...</span>
        </div>
      )}

      {!loadingDetail && activeSurveyDetail && (() => {
        const closeDate    = activeSurveyDetail.closeAt ? new Date(activeSurveyDetail.closeAt) : null;
        const closeDateStr = closeDate
          ? `${closeDate.getFullYear()}年${closeDate.getMonth() + 1}月${closeDate.getDate()}日`
          : null;

        return (
          <>
            <div className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-800 text-sm">{activeSurveyDetail.title}</h3>
                {closeDateStr && <p className="text-xs text-gray-400 mt-0.5">締切: {closeDateStr}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${activeSurveyDetail.isOpen ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {activeSurveyDetail.isOpen ? "受付中" : "締切"}
                </span>
                {isAdmin && (
                  <button
                    onClick={handleToggle}
                    disabled={toggling}
                    className="text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-60 transition-colors"
                  >
                    {toggling
                      ? <Loader2 size={12} className="animate-spin inline" />
                      : activeSurveyDetail.isOpen ? "締切る" : "再開する"}
                  </button>
                )}
              </div>
            </div>

            {stages.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">ステージが登録されていません</p>
            )}

            {stages.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div
                  className="grid text-xs font-medium text-gray-500 bg-gray-50 border-b border-gray-200 px-4 py-2.5"
                  style={{ gridTemplateColumns: `1fr${stages.map(() => " 80px").join("")} 1fr` }}
                >
                  <span>メンバー</span>
                  {stages.map((s) => (
                    <span key={s.id} className="text-center truncate px-1">{s.name}</span>
                  ))}
                  <span className="pl-3">メモ</span>
                </div>

                <div
                  className="grid text-xs border-b border-gray-200 bg-gray-50/60 px-4 py-2"
                  style={{ gridTemplateColumns: `1fr${stages.map(() => " 80px").join("")} 1fr` }}
                >
                  <span className="text-gray-400 text-[11px]">集計</span>
                  {stages.map((s) => {
                    const ss = activeSurveyDetail.stageSummaries.find((sm) => sm.stageId === s.id);
                    return (
                      <div key={s.id} className="text-center space-y-0.5">
                        <div className="text-green-600">○ {ss?.summary.attending ?? 0}</div>
                        <div className="text-red-500">✕ {ss?.summary.absent ?? 0}</div>
                        <div className="text-amber-500">△ {ss?.summary.maybe ?? 0}</div>
                        <div className="text-gray-400">— {ss?.summary.undecided ?? 0}</div>
                      </div>
                    );
                  })}
                  <span />
                </div>

                {activeSurveyDetail.rows.map((row, idx) => {
                  const isMyRow  = row.memberId === myMemberId;
                  const editable = canEdit(row.memberId) && (activeSurveyDetail.isOpen || isAdmin);
                  const memoValue = memoMap.get(row.memberId) ?? "";

                  return (
                    <div
                      key={row.memberId}
                      className={[
                        "grid items-center px-4 py-2.5",
                        idx < activeSurveyDetail.rows.length - 1 ? "border-b border-gray-100" : "",
                        isMyRow ? "bg-brand-50/40" : "",
                      ].join(" ")}
                      style={{ gridTemplateColumns: `1fr${stages.map(() => " 80px").join("")} 1fr` }}
                    >
                      <div className="min-w-0 pr-2">
                        <p className={`text-sm truncate ${isMyRow ? "font-semibold text-brand-700" : "text-gray-800"}`}>
                          {row.nameJa}
                          {isMyRow && <span className="ml-1 text-[10px] font-normal text-brand-400">（自分）</span>}
                        </p>
                        {row.partName && <p className="text-[11px] text-gray-400 truncate">{row.partName}</p>}
                      </div>

                      {stages.map((s) => {
                        const key    = `${row.memberId}:${s.id}`;
                        const status = stateMap.get(row.memberId)?.get(s.id) ?? "undecided";
                        const cfg    = SURVEY_STATUS_CONFIG[status];
                        const isSav  = saving === key;

                        return (
                          <div key={s.id} className="flex justify-center">
                            <button
                              onClick={() => handleCellClick(row.memberId, s.id)}
                              disabled={!editable || isSav}
                              className={[
                                "w-10 h-8 rounded-lg text-sm font-bold transition-colors",
                                cfg.cellClass,
                                cfg.badgeClass,
                                editable ? "hover:opacity-80 cursor-pointer" : "cursor-default",
                                (!activeSurveyDetail.isOpen && !isAdmin) ? "opacity-50" : "",
                              ].join(" ")}
                              title={cfg.label}
                            >
                              {isSav ? <Loader2 size={12} className="animate-spin mx-auto" /> : cfg.symbol}
                            </button>
                          </div>
                        );
                      })}

                      <div className="pl-3">
                        {editable ? (
                          <input
                            type="text"
                            value={memoValue}
                            onChange={(e) => {
                              const v = e.target.value;
                              setMemoMap((prev) => {
                                const next = new Map(prev);
                                if (v) next.set(row.memberId, v); else next.delete(row.memberId);
                                return next;
                              });
                            }}
                            onBlur={(e) => handleMemoBlur(row.memberId, e.target.value)}
                            placeholder="メモ"
                            className={[
                              "w-full text-xs border border-transparent rounded px-2 py-1 focus:outline-none focus:border-brand-300 bg-transparent focus:bg-white transition-colors placeholder-gray-300",
                              savingMemo === row.memberId ? "opacity-60" : "",
                            ].join(" ")}
                          />
                        ) : (
                          <span className="text-xs text-gray-500">{memoValue || ""}</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {activeSurveyDetail.rows.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-8">メンバーがいません</p>
                )}
              </div>
            )}
          </>
        );
      })()}

      {showCreateModal && (
        <CreateSurveyModal
          orgSlug={org}
          concertId={concert.id}
          surveyCount={surveys.length}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleSurveyCreated}
        />
      )}
    </div>
  );
}
