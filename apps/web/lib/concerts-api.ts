import { apiClient } from "./api-client";

export type ConcertStatus = "draft" | "survey_open" | "confirmed" | "past";
export type AttendanceStatus = "attending" | "absent" | "undecided";

export interface ConcertSummary {
  id: string;
  title: string;
  heldOn: string;
  venue: string | null;
  status: ConcertStatus;
  stageCount: number;
  programCount: number;
  hasSurvey: boolean;
  surveyOpen: boolean;
  linkedEventId: string | null;
}

export interface ProgramDetail {
  id: string;
  title: string;
  sortOrder: number;
  score: { id: string; composer: string | null; arranger: string | null } | null;
}

export interface FormationSlotDetail {
  id: string;
  memberId: string | null;
  nameJa: string | null;
  partName: string | null;
  label: string | null;
  boxId: string | null;
  rowNum: number | null;
  positionOrder: number;
}

export type PianoPosition = "center" | "kamite";
export type FormationBoxKind = "conductor" | "piano" | "custom";

export interface FormationBoxDetail {
  id: string;
  kind: FormationBoxKind;
  title: string | null;
  sortOrder: number;
}

export interface FormationPatternDetail {
  id: string;
  name: string;
  sortOrder: number;
  isStaggered: boolean;
  pianoPosition: PianoPosition;
  boxes: FormationBoxDetail[];
  slots: FormationSlotDetail[];
}

export interface StageDetail {
  id: string;
  name: string;
  sortOrder: number;
  programs: ProgramDetail[];
  formationPatterns?: FormationPatternDetail[];
}

export interface SurveySummary {
  id: string;
  title: string;
  isOpen: boolean;
  openAt: string;
  closeAt: string | null;
  responseCount: number;
}

export interface SurveyStageStatus {
  stageId: string;
  status: AttendanceStatus;
}

export interface SurveyMemberRow {
  memberId: string;
  nameJa: string;
  partId: string | null;
  partName: string | null;
  partSortOrder: number;
  partVoiceType: string;
  stages: SurveyStageStatus[];
  memo: string | null;
}

export interface SurveyStageSummary {
  stageId: string;
  summary: { attending: number; absent: number; undecided: number };
}

export interface SurveyDetail {
  id: string;
  title: string;
  isOpen: boolean;
  closeAt: string | null;
  rows: SurveyMemberRow[];
  stageSummaries: SurveyStageSummary[];
}

export type OnStageStatus = "on" | "off" | "undecided";

export interface AssignmentDetail {
  memberId: string;
  nameJa: string;
  partId: string | null;
  partName: string | null;
  partSortOrder: number;
  partVoiceType: string;
  stageId: string;
  status: OnStageStatus;
}

export interface ConcertDetail {
  id: string;
  title: string;
  heldOn: string;
  venue: string | null;
  status: ConcertStatus;
  linkedEventId: string | null;
  stages: StageDetail[];
  surveys: SurveySummary[];
  appliedSurveyId: string | null;
  assignments: AssignmentDetail[];
}

export interface UpdateConcertInput {
  title?: string;
  heldOn?: string;
  venue?: string | null;
  status?: ConcertStatus;
}

export interface CreateConcertInput {
  title: string;
  heldOn: string;
  endsAt?: string;
  venue?: string | null;
  locationUrl?: string | null;
  targetRoles?: string[] | null;
  targetPartIds?: string[] | null;
  deadline?: string | null;
  pageMemo?: string | null;
}

export interface AddStageInput {
  name: string;
}

export interface AddProgramInput {
  scoreId?: string;
  title?: string;
  composer?: string | null;
  arranger?: string | null;
  accessLevel?: "secret" | "restricted" | "public";
}

export interface UpdateProgramInput {
  title?: string;
  composer?: string | null;
  arranger?: string | null;
}

export interface ConcertStructure {
  id: string;
  title: string;
  stages: { id: string; name: string; sortOrder: number }[];
}

export const concertsApi = {
  list: (orgSlug: string) => apiClient.get<ConcertSummary[]>(`/${orgSlug}/concerts`),

  create: (orgSlug: string, data: CreateConcertInput) =>
    apiClient.post<ConcertSummary>(`/${orgSlug}/concerts`, data),

  get: (orgSlug: string, id: string) => apiClient.get<ConcertDetail>(`/${orgSlug}/concerts/${id}`),

  getStructure: (orgSlug: string) =>
    apiClient.get<ConcertStructure[]>(`/${orgSlug}/concerts/structure`),

  addStage: (orgSlug: string, concertId: string, data: AddStageInput) =>
    apiClient.post<StageDetail>(`/${orgSlug}/concerts/${concertId}/stages`, data),

  updateStage: (orgSlug: string, concertId: string, stageId: string, data: { name: string }) =>
    apiClient.patch<{ id: string; name: string; sortOrder: number }>(
      `/${orgSlug}/concerts/${concertId}/stages/${stageId}`,
      data,
    ),

  reorderStages: (orgSlug: string, concertId: string, ids: string[]) =>
    apiClient.put<void>(`/${orgSlug}/concerts/${concertId}/stages/order`, { ids }),

  reorderPrograms: (orgSlug: string, concertId: string, stageId: string, ids: string[]) =>
    apiClient.put<void>(`/${orgSlug}/concerts/${concertId}/stages/${stageId}/programs/order`, {
      ids,
    }),

  addProgram: (orgSlug: string, concertId: string, stageId: string, data: AddProgramInput) =>
    apiClient.post<ProgramDetail>(
      `/${orgSlug}/concerts/${concertId}/stages/${stageId}/programs`,
      data,
    ),

  deleteProgram: (orgSlug: string, concertId: string, programId: string) =>
    apiClient.delete(`/${orgSlug}/concerts/${concertId}/programs/${programId}`),

  updateProgram: (
    orgSlug: string,
    concertId: string,
    programId: string,
    data: UpdateProgramInput,
  ) =>
    apiClient.patch<ProgramDetail>(`/${orgSlug}/concerts/${concertId}/programs/${programId}`, data),

  update: (orgSlug: string, concertId: string, data: UpdateConcertInput) =>
    apiClient.patch<{
      id: string;
      title: string;
      heldOn: string;
      venue: string | null;
      status: ConcertStatus;
    }>(`/${orgSlug}/concerts/${concertId}`, data),

  delete: (orgSlug: string, concertId: string) =>
    apiClient.delete(`/${orgSlug}/concerts/${concertId}`),

  createSurvey: (
    orgSlug: string,
    concertId: string,
    data: { title: string; closeAt?: string | null },
  ) => apiClient.post<SurveySummary>(`/${orgSlug}/concerts/${concertId}/surveys`, data),

  getSurveyDetail: (orgSlug: string, concertId: string, surveyId: string) =>
    apiClient.get<SurveyDetail>(`/${orgSlug}/concerts/${concertId}/surveys/${surveyId}`),

  patchSurvey: (
    orgSlug: string,
    concertId: string,
    surveyId: string,
    data: { isOpen?: boolean; title?: string },
  ) =>
    apiClient.patch<{ id: string; title: string; isOpen: boolean; concertStatus: ConcertStatus }>(
      `/${orgSlug}/concerts/${concertId}/surveys/${surveyId}`,
      data,
    ),

  respondSurvey: (
    orgSlug: string,
    concertId: string,
    surveyId: string,
    responses: { stageId: string; status: AttendanceStatus }[],
    memo?: string | null,
    targetMemberId?: string,
  ) =>
    apiClient.put<{ ok: boolean }>(
      `/${orgSlug}/concerts/${concertId}/surveys/${surveyId}/respond`,
      { responses, memo: memo ?? undefined, targetMemberId },
    ),

  applySurveyToFormation: (orgSlug: string, concertId: string, surveyId: string) =>
    apiClient.post<{ ok: boolean }>(
      `/${orgSlug}/concerts/${concertId}/surveys/${surveyId}/apply`,
      {},
    ),

  createFormationPattern: (orgSlug: string, concertId: string, stageId: string, name: string) =>
    apiClient.post<FormationPatternDetail>(
      `/${orgSlug}/concerts/${concertId}/stages/${stageId}/formation-patterns`,
      { name },
    ),

  updateFormationPattern: (
    orgSlug: string,
    concertId: string,
    stageId: string,
    patternId: string,
    patch: Partial<{ name: string; isStaggered: boolean; pianoPosition: PianoPosition }>,
  ) =>
    apiClient.patch<{
      id: string;
      name: string;
      sortOrder: number;
      isStaggered: boolean;
      pianoPosition: PianoPosition;
    }>(
      `/${orgSlug}/concerts/${concertId}/stages/${stageId}/formation-patterns/${patternId}`,
      patch,
    ),

  deleteFormationPattern: (
    orgSlug: string,
    concertId: string,
    stageId: string,
    patternId: string,
  ) =>
    apiClient.delete(
      `/${orgSlug}/concerts/${concertId}/stages/${stageId}/formation-patterns/${patternId}`,
    ),

  reorderFormationPatterns: (orgSlug: string, concertId: string, stageId: string, ids: string[]) =>
    apiClient.put<void>(
      `/${orgSlug}/concerts/${concertId}/stages/${stageId}/formation-patterns/order`,
      { ids },
    ),

  saveFormationSlots: (
    orgSlug: string,
    concertId: string,
    stageId: string,
    patternId: string,
    payload: {
      boxes: { clientId: string; kind: FormationBoxKind; title?: string; sortOrder: number }[];
      slots: {
        memberId?: string;
        label?: string;
        boxClientId?: string;
        rowNum?: number;
        positionOrder: number;
      }[];
    },
  ) =>
    apiClient.put<void>(
      `/${orgSlug}/concerts/${concertId}/stages/${stageId}/formation-patterns/${patternId}/slots`,
      payload,
    ),
};
