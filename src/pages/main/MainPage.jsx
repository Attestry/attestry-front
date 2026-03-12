import React from 'react';
import { Link } from 'react-router-dom';
import useAuthStore, { ROLES } from '../../store/useAuthStore';
import { getRoleLandingPath } from '../../utils/roleNavigation';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronRight,
  Leaf,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

const heroStats = [
  { label: 'C2C Transfer', value: '개인 간 소유권 이전' },
  { label: 'Ledger Record', value: '원장 기반 이력 기록' },
  { label: 'Operational Roles', value: '브랜드 · 리테일 · 서비스 운영 연결' },
];

const pillars = [
  {
    icon: ShieldCheck,
    title: '신뢰가 남는 소유권 이전',
    description: '개인 간 이전 이후에도 제품 이력과 보유 상태가 끊기지 않도록 기록을 남깁니다.',
  },
  {
    icon: Wrench,
    title: '원장 중심의 이력 구조',
    description: '제품 이력과 소유권 변화를 원장 기록 기준으로 확인할 수 있도록 흐름을 정리합니다.',
  },
  {
    icon: Leaf,
    title: '역할별 운영까지 자연스럽게 연결',
    description: '브랜드, 리테일, 서비스 기능도 같은 원장 구조 안에서 이어져 운영 흐름을 단정하게 만듭니다.',
  },
];

const flowSteps = [
  {
    step: '01',
    title: '제품 이력과 원장 기록 생성',
    description: '제품의 시작점과 핵심 이력을 먼저 기록해 이후 소유권 변화의 기준을 만듭니다.',
    tone: 'from-slate-950 to-stone-700',
  },
  {
    step: '02',
    title: 'B2C와 C2C 소유권 이전',
    description: '판매 이후의 이전뿐 아니라 개인 간 이전까지 같은 신뢰 구조 안에서 연결합니다.',
    tone: 'from-[#80522c] to-[#c79057]',
  },
  {
    step: '03',
    title: '개인 사용자 이전과 원장 기록',
    description: '최종 소유자는 C2C 이전을 진행하고 제품 이력, 서비스 이력, 원장 기록을 함께 확인합니다.',
    tone: 'from-[#111827] to-[#5b6472]',
  },
];

const roleCards = [
  {
    name: '브랜드',
    summary: '제품 등록과 출고 관리로 원장 구조를 시작합니다',
    accent: 'from-[#eef3ff] to-[#f9fbff] border-[#d9e4ff] text-[#2248a8]',
  },
  {
    name: '리테일',
    summary: '판매 이후 이전 상태와 보유 흐름을 연결합니다',
    accent: 'from-[#eef8f1] to-[#fbfefc] border-[#d7eadf] text-[#2f6d4f]',
  },
  {
    name: '서비스',
    summary: '서비스 이력을 제품 신뢰에 연결하는 확장 기능입니다',
    accent: 'from-[#fff5ea] to-[#fffdf9] border-[#f2dcc1] text-[#9a6227]',
  },
];

const MainPage = () => {
  const { isAuthenticated, user } = useAuthStore();
  const isUserRole = (user?.role || ROLES.USER) === ROLES.USER;
  const primaryCtaTo = isAuthenticated
    ? (isUserRole ? '/transfer/receive' : getRoleLandingPath(user?.role || ROLES.USER))
    : '/signup';
  const primaryCtaLabel = isAuthenticated
    ? (isUserRole ? '소유권 이전 받기' : '내 작업 화면 열기')
    : '회원가입';

  return (
    <div className="overflow-hidden bg-[var(--color-page)] text-slate-900">
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,#fcfbf8_0%,#f4efe5_40%,#eef2f7_100%)]" />
        <div className="absolute left-[-12rem] top-10 -z-10 h-[30rem] w-[30rem] rounded-full bg-[rgba(15,23,42,0.07)] blur-3xl" />
        <div className="absolute right-[-10rem] top-16 -z-10 h-[28rem] w-[28rem] rounded-full bg-[rgba(180,120,55,0.10)] blur-3xl" />
        <div className="absolute inset-x-0 top-0 -z-10 h-px bg-[linear-gradient(90deg,transparent,rgba(15,23,42,0.16),transparent)]" />

        <div className="mx-auto max-w-7xl px-4 pb-22 pt-18 sm:px-6 lg:px-8 lg:pb-30 lg:pt-28">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_25rem] lg:items-end">
            <div className="max-w-5xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/82 px-4 py-2 text-[11px] font-semibold tracking-[0.24em] text-slate-600 shadow-[0_12px_30px_rgba(15,23,42,0.05)]">
                <BadgeCheck size={14} />
                TRACERA
              </div>

              <h1 className="tracera-keepall mt-8 max-w-4xl text-[3rem] font-semibold tracking-[-0.095em] text-slate-950 sm:text-[4.8rem] lg:text-[6.2rem] lg:leading-[0.92]">
                소유권이 바뀌어도
                <span className="block bg-[linear-gradient(180deg,#0f172a_0%,#3f4b5f_100%)] bg-clip-text text-transparent">신뢰는 남아야 합니다</span>
              </h1>

              <p className="tracera-keepall mt-7 max-w-2xl text-base leading-8 text-slate-600 sm:text-[1.06rem]">
                Tracera는 개인 간 C2C 소유권 이전과 원장 기록을 핵심으로, 제품 이력과 서비스 이력까지 하나의 신뢰 구조 안에서 정리하는 프리미엄 트레이서빌리티 서비스입니다.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={primaryCtaTo}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-4 text-sm font-semibold !text-white shadow-[0_22px_44px_rgba(15,23,42,0.2)] transition-all hover:-translate-y-0.5 hover:bg-stone-800"
                >
                  {primaryCtaLabel}
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#flow"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/90 bg-white/90 px-6 py-4 text-sm font-semibold !text-slate-950 shadow-[0_14px_30px_rgba(15,23,42,0.06)] transition-all hover:-translate-y-0.5 hover:bg-white"
                >
                  서비스 구조 보기
                  <ChevronRight size={16} />
                </a>
              </div>

              <div className="mt-10 grid gap-3 sm:grid-cols-3">
                {heroStats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[1.55rem] border border-white/80 bg-white/68 px-5 py-4 shadow-[0_14px_32px_rgba(15,23,42,0.05)] backdrop-blur"
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{item.label}</div>
                    <div className="mt-2 text-sm font-semibold leading-6 text-slate-950">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="relative overflow-hidden rounded-[2.2rem] border border-[rgba(255,255,255,0.18)] bg-[linear-gradient(160deg,#13100d_0%,#231b16_52%,#5b4638_100%)] p-6 text-white shadow-[0_34px_90px_rgba(15,23,42,0.18)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.14),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(245,158,11,0.12),transparent_30%)]" />
              <div className="relative">
                <div className="text-sm font-semibold tracking-[0.18em] text-white/52">Operational View</div>
                <h2 className="tracera-keepall mt-4 text-[1.9rem] font-semibold leading-[1.15] tracking-[-0.06em] text-white">
                  복잡한 제품 이력을
                  <span className="block text-stone-200">바로 이해되는 흐름으로</span>
                </h2>
                <p className="tracera-keepall mt-4 text-sm leading-7 text-white/76">
                  개인 사용자, 브랜드, 리테일, 서비스 파트너가 같은 제품 데이터를 더 빠르게 읽고 C2C 이전과 원장 기록까지 실제 운영에 활용할 수 있도록 설계합니다.
                </p>

                <div className="mt-6 space-y-3">
                  {flowSteps.map((item) => (
                    <div key={item.step} className="rounded-[1.3rem] border border-white/10 bg-white/7 px-4 py-3 backdrop-blur">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-white ${item.tone}`}>
                          {item.step}
                        </div>
                        <div className="tracera-keepall text-sm font-semibold text-white">{item.title}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  {isAuthenticated ? (
                    <Link
                      to={isUserRole ? '/mypage' : getRoleLandingPath(user?.role || ROLES.USER)}
                      className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#fff7ed_0%,#f3e8d4_100%)] px-5 py-3.5 text-sm font-semibold !text-[#1f1712] shadow-[0_18px_34px_rgba(0,0,0,0.16)] ring-1 ring-[rgba(255,255,255,0.24)] transition-all hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#fffbf5_0%,#efe1c8_100%)]"
                    >
                      {isUserRole ? '내 제품 이력 보기' : '내 작업 화면 열기'}
                      <ArrowRight size={15} />
                    </Link>
                  ) : (
                    <Link
                      to="/login"
                      className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#fff7ed_0%,#f3e8d4_100%)] px-5 py-3.5 text-sm font-semibold !text-[#1f1712] shadow-[0_18px_34px_rgba(0,0,0,0.16)] ring-1 ring-[rgba(255,255,255,0.24)] transition-all hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#fffbf5_0%,#efe1c8_100%)]"
                    >
                      로그인하고 보기
                      <ArrowRight size={15} />
                    </Link>
                  )}
                  <a
                    href="#value"
                    className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/18 bg-white/8 px-5 py-3.5 text-sm font-semibold !text-white transition-all hover:-translate-y-0.5 hover:bg-white/12"
                  >
                    서비스 가치 보기
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section id="value" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="rounded-[2.3rem] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(244,246,248,0.8))] p-6 shadow-[0_30px_90px_rgba(15,23,42,0.08)] backdrop-blur sm:p-8 lg:p-10">
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-sm font-semibold tracking-[0.18em] text-slate-500">서비스 가치</div>
                <h2 className="tracera-keepall mt-3 text-3xl font-semibold tracking-[-0.065em] text-slate-950 sm:text-4xl">
                  신뢰가 필요한 순간에
                  <span className="block">바로 확인되는 기록을 남깁니다</span>
                </h2>
              </div>
              <p className="tracera-keepall max-w-sm text-sm leading-7 text-slate-600">
                Tracera의 핵심은 제품 이력과 소유권 변화를 누구나 같은 기준으로 확인할 수 있게 만드는 데 있습니다.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {pillars.map((pillar) => (
                <article
                  key={pillar.title}
                  className="rounded-[1.75rem] border border-slate-200/90 bg-white/94 p-5 shadow-[0_12px_28px_rgba(15,23,42,0.04)]"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <pillar.icon size={18} />
                  </div>
                  <h3 className="tracera-keepall mt-5 text-lg font-semibold tracking-[-0.04em] text-slate-950">{pillar.title}</h3>
                  <p className="tracera-keepall mt-3 text-sm leading-7 text-slate-600">{pillar.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-[2.3rem] border border-[rgba(120,53,15,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(250,248,244,0.86))] p-6 shadow-[0_30px_90px_rgba(15,23,42,0.08)]">
            <div className="text-sm font-semibold tracking-[0.18em] text-slate-500">운영 포인트</div>
            <h3 className="tracera-keepall mt-4 text-[1.8rem] font-semibold tracking-[-0.05em] leading-[1.18] text-slate-950">
              현장에서 바로 쓰이는 구조가
              <span className="block">서비스 신뢰를 만듭니다</span>
            </h3>
            <div className="mt-6 space-y-3 text-sm">
              <div className="tracera-keepall rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm">제품 등록, 출고, 이전, 서비스 이력이 하나의 문맥으로 이어집니다</div>
              <div className="tracera-keepall rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm">브랜드와 리테일, 서비스 파트너가 같은 데이터를 다른 역할로 활용할 수 있습니다</div>
              <div className="tracera-keepall rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm">보여주기용 페이지가 아니라 실제 운영 상태를 빠르게 판단하는 화면을 지향합니다</div>
            </div>
          </div>
        </div>
      </section>

      <section id="flow" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[24rem_minmax(0,1fr)] lg:gap-14">
          <div className="rounded-[2.2rem] border border-[rgba(120,53,15,0.1)] bg-[linear-gradient(160deg,#16120f_0%,#241c17_52%,#5b473a_100%)] p-7 text-white shadow-[0_30px_90px_rgba(15,23,42,0.16)]">
            <div className="text-sm font-semibold tracking-[0.18em] text-white/55">서비스 구조</div>
            <h2 className="tracera-keepall mt-4 text-3xl font-semibold tracking-[-0.06em] text-white sm:text-4xl">
              제품의 이력을
              <span className="block text-stone-200">읽기 쉬운 흐름으로 정리합니다</span>
            </h2>
            <div className="mt-8 space-y-4">
              <div className="tracera-keepall rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm leading-7 text-white/80">
                제품 등록부터 유통, B2C와 C2C 소유권 이전, 서비스, 재활용까지 하나의 흐름으로 연결됩니다.
              </div>
              <div className="tracera-keepall rounded-[1.2rem] border border-white/10 bg-white/6 px-4 py-3 text-sm leading-7 text-white/80">
                보여주기 위한 기록이 아니라 개인 사용자와 운영 주체 모두가 신뢰 기준으로 삼을 수 있는 데이터 구조를 지향합니다.
              </div>
            </div>
          </div>

          <div className="relative grid gap-4">
            <div className="absolute left-[1.35rem] top-10 hidden h-[calc(100%-5rem)] w-px bg-[linear-gradient(180deg,rgba(120,53,15,0.16),rgba(148,163,184,0.1))] md:block" />
            {flowSteps.map((item) => (
              <article
                key={item.step}
                className="relative rounded-[1.95rem] border border-slate-200/90 bg-white/96 px-6 py-6 shadow-[0_16px_45px_rgba(15,23,42,0.05)] backdrop-blur"
              >
                <div className="flex items-start gap-4">
                  <div className={`relative z-10 flex h-11 w-11 flex-none items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white shadow-[0_12px_26px_rgba(15,23,42,0.18)] ${item.tone}`}>
                    {item.step}
                  </div>
                  <div>
                    <h3 className="tracera-keepall text-lg font-semibold tracking-[-0.03em] text-slate-950">{item.title}</h3>
                    <p className="tracera-keepall mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="partners" className="border-y border-[rgba(148,163,184,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.6),rgba(255,255,255,0.78))] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-semibold tracking-[0.18em] text-slate-500">운영 역할</div>
              <h2 className="tracera-keepall mt-4 text-3xl font-semibold tracking-[-0.06em] text-slate-950 sm:text-4xl">
                개인 신뢰를 중심에 두되
                <span className="block">운영 주체별 역할도 분명하게 연결합니다</span>
              </h2>
            </div>
            <p className="tracera-keepall max-w-xl text-sm leading-7 text-slate-600">
              개인 사용자 중심의 신뢰 구조를 유지하면서도 브랜드, 리테일, 서비스 주체가 각자의 역할에 맞게 제품 데이터를 활용할 수 있도록 정리합니다.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {roleCards.map((role) => (
              <article
                key={role.name}
                className={`rounded-[2rem] border bg-gradient-to-br p-6 shadow-[0_14px_34px_rgba(15,23,42,0.04)] ${role.accent}`}
              >
                <div className="inline-flex rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm">
                  {role.name}
                </div>
                <p className="tracera-keepall mt-5 text-sm leading-7 text-slate-700">{role.summary}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
            <Building2 size={20} className="text-slate-900" />
            <h3 className="tracera-keepall mt-5 text-xl font-semibold tracking-[-0.04em] text-slate-950">
              제품 이후의 관계까지 이어지는 구조
            </h3>
            <p className="tracera-keepall mt-3 max-w-xl text-sm leading-7 text-slate-600">
              판매 이후에도 브랜드, 리테일, 최종 소유자가 같은 이력을 바탕으로 연결될 수 있도록 데이터 흐름을 설계합니다.
            </p>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
            <ArrowRight size={20} className="text-slate-900" />
            <h3 className="tracera-keepall mt-5 text-xl font-semibold tracking-[-0.04em] text-slate-950">
              복잡한 기능을 더 단정한 경험으로
            </h3>
            <p className="tracera-keepall mt-3 max-w-xl text-sm leading-7 text-slate-600">
              운영자는 더 명확하게 관리하고, 사용자는 더 쉽게 이해할 수 있도록 제품 이력을 읽기 좋은 화면 경험으로 제공합니다.
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-[2.2rem] border border-[rgba(15,23,42,0.08)] bg-[linear-gradient(135deg,#0b1220_0%,#111827_42%,#5b4638_100%)] px-6 py-8 text-white shadow-[0_32px_80px_rgba(15,23,42,0.18)] sm:px-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-center">
            <div>
              <div className="text-sm font-semibold tracking-[0.18em] text-white/55">TRACERA</div>
              <p className="tracera-keepall mt-3 max-w-3xl text-[1.9rem] font-semibold tracking-[-0.05em] leading-[1.2] text-white sm:text-[2.3rem]">
                제품이 지나온 모든 순간을
                <span className="block text-stone-200">하나의 신뢰로 연결하는 일</span>
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                to={primaryCtaTo}
                className="tracera-button-secondary w-full justify-center !border-white/10 !bg-white !text-slate-950"
              >
                {primaryCtaLabel}
              </Link>
              <Link to="/onboarding" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/16 bg-white/8 px-5 py-3.5 text-sm font-semibold !text-white transition hover:bg-white/12">
                업체 신청 페이지
                <ChevronRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MainPage;
