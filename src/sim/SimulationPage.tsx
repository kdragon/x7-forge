import { useMemo, useState } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from 'chart.js';
import type { TooltipItem } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar, Pie } from 'react-chartjs-2';
import { DEFAULT_ENHANCE_RATES } from '../config/enhanceRules';
import { BASE_ATTACK_BY_TIER, BASE_DEFENSE_BY_TIER, getMaxGradeForTier, rollBonusAttack, rollBonusDefense } from '../config/itemRules';
import { gradeOrder } from '../core/enhance';

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, ChartDataLabels);

type ItemType = 'weapon' | 'armor';

type SimulationInput = {
  tier: number;
  itemType: ItemType;
  minOptionPercent: number;
  srRequired: boolean;
  targetEnhance: number;
  targetGrade: string;
  attempts: number;
};

type StonePool = { low: number; mid: number; high: number };

type SimulationResult = {
  attempts: number;
  totalEnhanceAttempts: number;
  optionSelectedCount: number;
  successEnhance: number;
  successTarget: number;
  stageCounts: Record<number, number>;
  stages: number[];
  successes: boolean[];
  stonesGained: StonePool;
  stonesSpent: StonePool;
  stonesRemaining: StonePool;
  targetGrade: string;
};

const SR_RATE = 0.05;

type GradeRange = { min: number; max: number };

const DEFAULT_DISASSEMBLE_RANGES: Record<string, GradeRange> = {
  일반: { min: 3, max: 5 },
  고급: { min: 6, max: 10 },
  희귀: { min: 12, max: 20 },
  고대: { min: 30, max: 50 },
  영웅: { min: 75, max: 125 },
  유일: { min: 225, max: 375 },
  유물: { min: 675, max: 1125 },
};

const DEFAULT_UPGRADE_COSTS: Record<string, number> = {
  일반: 10,
  고급: 20,
  희귀: 40,
  고대: 100,
  영웅: 250,
  유일: 750,
};

const initialInput: SimulationInput = {
  tier: 5,
  itemType: 'weapon',
  minOptionPercent: 5,
  srRequired: false,
  targetEnhance: 7,
  targetGrade: '유일',
  attempts: 1000,
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export default function SimulationPage() {
  const [input, setInput] = useState<SimulationInput>(initialInput);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [enhanceRates, setEnhanceRates] = useState<number[]>(DEFAULT_ENHANCE_RATES);
  const [disassembleRanges, setDisassembleRanges] = useState<Record<string, GradeRange>>(DEFAULT_DISASSEMBLE_RANGES);
  const [upgradeCosts, setUpgradeCosts] = useState<Record<string, number>>(DEFAULT_UPGRADE_COSTS);
  const [isScenarioOpen, setIsScenarioOpen] = useState(false);

  const maxGrade = getMaxGradeForTier(input.tier);
  const maxGradeIndex = gradeOrder.indexOf(maxGrade);
  const targetGradeIndex = gradeOrder.indexOf(input.targetGrade as (typeof gradeOrder)[number]);
  const effectiveTargetGrade = targetGradeIndex <= maxGradeIndex ? input.targetGrade : maxGrade;
  const isTargetCapped = effectiveTargetGrade !== input.targetGrade;

  const runSimulation = () => {
    setIsRunning(true);

    const attempts = clamp(Math.floor(input.attempts), 1, 100000);
    const targetEnhance = clamp(Math.floor(input.targetEnhance), 0, 9);
    const minOptionPercent = clamp(input.minOptionPercent, 0, 100);

    const stages: number[] = [];
    const successes: boolean[] = [];
    const stageCounts: Record<number, number> = {};
    const stones: StonePool = { low: 0, mid: 0, high: 0 };
    const stonesGained: StonePool = { low: 0, mid: 0, high: 0 };
    const stonesSpent: StonePool = { low: 0, mid: 0, high: 0 };
    let successEnhance = 0;
    let successTarget = 0;
    let totalEnhanceAttempts = 0;
    let optionSelectedCount = 0;

    const normalizedEnhanceRates = enhanceRates.map((rate) => clamp(rate, 0, 100));
    const normalizedDisassembleRanges = Object.fromEntries(
      gradeOrder.map((grade) => {
        const range = disassembleRanges[grade] ?? { min: 2, max: 4 };
        const min = Math.max(0, Math.min(range.min, range.max));
        const max = Math.max(0, Math.max(range.min, range.max));
        return [grade, { min, max }];
      }),
    ) as Record<string, GradeRange>;
    const normalizedUpgradeCosts = gradeOrder.slice(0, -1).reduce((acc, grade) => {
      const raw = upgradeCosts[grade];
      acc[grade] = Math.max(0, Math.floor(Number.isFinite(raw) ? raw : 0));
      return acc;
    }, {} as Record<string, number>);

    const pendingUpgrades: number[] = [];
    const startGrade = '일반';
    const targetGrade = effectiveTargetGrade;

    const getStoneType = (tier: number) => (tier <= 2 ? 'low' : tier <= 4 ? 'mid' : 'high');

    const addStones = (tier: number, grade: string) => {
      const range = normalizedDisassembleRanges[grade] ?? { min: 2, max: 4 };
      const amount = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
      const stoneType = getStoneType(tier);
      stones[stoneType] += amount;
      stonesGained[stoneType] += amount;
    };

    const targetGradeOrderIndex = gradeOrder.indexOf(targetGrade as (typeof gradeOrder)[number]);

    const tryUpgradePending = () => {
      while (pendingUpgrades.length > 0) {
        let gradeIndex = pendingUpgrades[0];
        let progressed = false;
        while (gradeIndex < targetGradeOrderIndex) {
          const currentGrade = gradeOrder[gradeIndex];
          const costAmount = normalizedUpgradeCosts[currentGrade];
          if (costAmount === undefined) break;
          const stoneType = getStoneType(input.tier);
          if (stones[stoneType] < costAmount) break;
          stones[stoneType] -= costAmount;
          stonesSpent[stoneType] += costAmount;
          gradeIndex += 1;
          progressed = true;
        }
        if (gradeIndex >= targetGradeOrderIndex) {
          successTarget += 1;
          pendingUpgrades.shift();
          continue;
        }
        pendingUpgrades[0] = gradeIndex;
        if (!progressed) {
          break;
        }
        break;
      }
    };

    const getBase = (tier: number) => (input.itemType === 'weapon'
      ? (BASE_ATTACK_BY_TIER[tier] ?? tier * 100)
      : (BASE_DEFENSE_BY_TIER[tier] ?? 90));

    const getOptionValue = (tier: number) => (input.itemType === 'weapon'
      ? rollBonusAttack(tier)
      : rollBonusDefense(tier));

    for (let i = 0; i < attempts; i += 1) {
      const base = getBase(input.tier);
      const requiredValue = Math.floor(base * (minOptionPercent / 100));
      const optionValue = getOptionValue(input.tier);
      const isSr = Math.random() < SR_RATE;
      const optionOk = optionValue >= requiredValue && (!input.srRequired || isSr);

      if (!optionOk) {
        addStones(input.tier, startGrade);
        stages.push(0);
        successes.push(false);
        stageCounts[0] = (stageCounts[0] ?? 0) + 1;
        tryUpgradePending();
        continue;
      }

      optionSelectedCount += 1;

      let currentEnhance = 0;
      let destroyed = false;
      for (let level = 0; level < targetEnhance; level += 1) {
        totalEnhanceAttempts += 1;
        const rate = normalizedEnhanceRates[level] ?? 0;
        if (Math.random() * 100 <= rate) {
          currentEnhance += 1;
        } else {
          destroyed = true;
          break;
        }
      }

      if (destroyed) {
        addStones(input.tier, startGrade);
        stages.push(currentEnhance);
        successes.push(false);
        stageCounts[currentEnhance] = (stageCounts[currentEnhance] ?? 0) + 1;
        tryUpgradePending();
        continue;
      }

      successEnhance += 1;
      stages.push(currentEnhance);
      successes.push(true);
      stageCounts[currentEnhance] = (stageCounts[currentEnhance] ?? 0) + 1;
      pendingUpgrades.push(gradeOrder.indexOf(startGrade));
      tryUpgradePending();
    }

    setResult({
      attempts,
      totalEnhanceAttempts,
      optionSelectedCount,
      successEnhance,
      successTarget,
      stageCounts,
      stages,
      successes,
      stonesGained,
      stonesSpent,
      stonesRemaining: { ...stones },
      targetGrade,
    });
    setIsRunning(false);
  };

  const pieData = useMemo(() => {
    if (!result) return null;
    const stages = Object.keys(result.stageCounts)
      .map(Number)
      .sort((a, b) => a - b);
    const palette = ['#ef5350', '#ffb74d', '#4fc3f7', '#81c784', '#ba68c8', '#90a4ae', '#f06292', '#ffd54f', '#4db6ac', '#7986cb'];
    return {
      labels: stages.map((stage) => `${stage}강`),
      datasets: [
        {
          label: '강화 단계 분포',
          data: stages.map((stage) => result.stageCounts[stage] ?? 0),
          backgroundColor: stages.map((_, index) => palette[index % palette.length]),
          radius: '68%',
          borderWidth: 0,
        },
      ],
    };
  }, [result]);

  const barData = useMemo(() => {
    if (!result) return null;
    const total = result.stages.length;
    const windowSize = Math.min(1000, total);
    const firstSuccessIndex = result.successes.findIndex(Boolean);
    let windowStart = 0;

    if (total > 1000) {
      const hasSuccessInFirstWindow = result.successes.slice(0, 1000).some(Boolean);
      if (!hasSuccessInFirstWindow && firstSuccessIndex >= 0) {
        windowStart = Math.max(0, firstSuccessIndex - Math.floor(windowSize / 2));
      }
    }

    if (windowStart + windowSize > total) {
      windowStart = Math.max(0, total - windowSize);
    }

    const windowEnd = windowStart + windowSize;
    const labels = result.stages.slice(windowStart, windowEnd).map((_, index) => `${windowStart + index + 1}`);
    const colors = result.successes.slice(windowStart, windowEnd).map((success) => (success ? '#ef5350' : '#9e9e9e'));

    return {
      labels,
      datasets: [
        {
          label: '강화 단계',
          data: result.stages.slice(windowStart, windowEnd),
          backgroundColor: colors,
          borderWidth: 0,
        },
      ],
      meta: { windowStart, windowEnd },
    };
  }, [result]);

  const pieOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: {
        position: 'right' as const,
        fullSize: false,
        labels: {
          color: '#ddd',
          boxWidth: 12,
          padding: 8,
          font: { size: 11 },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'pie'>) => {
            if (!result) return '';
            const total = Object.values(result.stageCounts).reduce((sum, value) => sum + value, 0) || 1;
            const raw = typeof ctx.raw === 'number' ? ctx.raw : 0;
            const label = ctx.label ?? '';
            const percent = ((raw / total) * 100).toFixed(1);
            return `${label}: ${raw.toLocaleString()}개 (${percent}%)`;
          },
        },
      },
      datalabels: {
        color: '#fff',
        font: { weight: 'bold' as const, size: 12 },
        formatter: (value: number) => {
          if (!result) return '';
          const total = Object.values(result.stageCounts).reduce((sum, count) => sum + count, 0) || 1;
          const percent = (value / total) * 100;
          return `${percent.toFixed(1)}%`;
        },
      },
    },
  }), [result]);

  const barOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => {
            const raw = typeof ctx.raw === 'number' ? ctx.raw : 0;
            if (!barData) return `강화 단계: ${raw}`;
            const startIndex = barData.meta?.windowStart ?? 0;
            const absoluteIndex = startIndex + ctx.dataIndex + 1;
            return `${absoluteIndex}번째 · 강화 단계 ${raw}`;
          },
        },
      },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 20,
          color: '#aaa',
        },
        grid: { color: 'rgba(255,255,255,0.05)' },
      },
      y: {
        ticks: {
          color: '#aaa',
          stepSize: 1,
        },
        grid: { color: 'rgba(255,255,255,0.08)' },
        suggestedMax: 9,
      },
    },
  }), [barData]);

  return (
    <div style={{ padding: '24px', color: '#e0e0e0', backgroundColor: '#121212', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, color: '#ffd700' }}>몬테카를로 시뮬레이션(Monte Carlo Simulation)</h2>
        <a href="#/" style={{ color: '#90caf9', textDecoration: 'none', fontSize: '0.9rem' }}>게임으로 돌아가기</a>
      </div>

      <details
        open={isScenarioOpen}
        onToggle={(e) => setIsScenarioOpen((e.currentTarget as HTMLDetailsElement).open)}
        style={{ padding: '12px 16px', backgroundColor: '#1e1e1e', borderRadius: '8px', marginBottom: '16px', border: '1px solid #2b2b2b' }}
      >
        <summary style={{ cursor: 'pointer', color: '#ffb74d', fontWeight: 'bold', listStyle: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.9rem', color: '#ffd54f' }} aria-hidden="true">
            {isScenarioOpen ? '▾' : '▸'}
          </span>
          <span>시뮬레이션 시나리오 (기본)</span>
        </summary>
        <div style={{ marginTop: '12px' }}>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: '#cfcfcf' }}>
            <li>아이템은 무한 공급으로 가정합니다.</li>
            <li>옵션 조건을 만족하지 못한 아이템은 즉시 분해합니다.</li>
            <li>보호제는 사용하지 않습니다.</li>
            <li>시행 횟수만큼 반복하며 목표 달성 개수를 집계합니다.</li>
            <li>추가 옵션은 5~10%를 이산 분포(10/16/16/16/16/26)로 선택 후 기본 수치에 곱해 올림 처리합니다.</li>
          </ul>
          <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#bdbdbd' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#90caf9' }}>강화 성공 확률 (%)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '8px' }}>
              {enhanceRates.map((rate, index) => (
                <label key={`rate-${index}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#cfcfcf' }}>+{index + 1}</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={rate}
                    onChange={(e) => setEnhanceRates(prev => prev.map((value, idx) => (idx === index ? Number(e.target.value) : value)))}
                    style={{ padding: '4px 6px' }}
                  />
                </label>
              ))}
            </div>

            <div style={{ fontWeight: 'bold', margin: '12px 0 6px', color: '#90caf9' }}>분해 숯돌 범위</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              {gradeOrder.map((grade) => (
                <div key={`range-${grade}`} style={{ backgroundColor: '#222', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#cfcfcf', marginBottom: '4px' }}>{grade}</div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={disassembleRanges[grade]?.min ?? 0}
                      onChange={(e) => setDisassembleRanges(prev => ({
                        ...prev,
                        [grade]: { min: Number(e.target.value), max: prev[grade]?.max ?? 0 },
                      }))}
                      style={{ width: '70px', padding: '4px 6px' }}
                    />
                    <span>~</span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={disassembleRanges[grade]?.max ?? 0}
                      onChange={(e) => setDisassembleRanges(prev => ({
                        ...prev,
                        [grade]: { min: prev[grade]?.min ?? 0, max: Number(e.target.value) },
                      }))}
                      style={{ width: '70px', padding: '4px 6px' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 'bold', margin: '12px 0 6px', color: '#90caf9' }}>승급 숯돌 비용</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px' }}>
              {gradeOrder.slice(0, -1).map((grade, index) => (
                <div key={`upgrade-${grade}`} style={{ backgroundColor: '#222', padding: '6px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#cfcfcf', marginBottom: '4px' }}>
                    {grade}→{gradeOrder[index + 1]}
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={upgradeCosts[grade] ?? 0}
                    onChange={(e) => setUpgradeCosts(prev => ({ ...prev, [grade]: Number(e.target.value) }))}
                    style={{ width: '90px', padding: '4px 6px' }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div>
          <label style={{ fontSize: '0.85rem' }}>티어</label>
          <select
            value={input.tier}
            onChange={(e) => setInput(prev => ({ ...prev, tier: Number(e.target.value) }))}
            style={{ width: '100%', padding: '6px 8px', marginTop: '4px' }}
          >
            {[1, 2, 3, 4, 5, 6, 7].map((tier) => (
              <option key={tier} value={tier}>{tier}T</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.85rem' }}>아이템 종류</label>
          <select
            value={input.itemType}
            onChange={(e) => setInput(prev => ({ ...prev, itemType: e.target.value as ItemType }))}
            style={{ width: '100%', padding: '6px 8px', marginTop: '4px' }}
          >
            <option value="weapon">무기</option>
            <option value="armor">방어구</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.85rem' }}>옵션 조건 (최소 %)</label>
          <select
            value={input.minOptionPercent}
            onChange={(e) => setInput(prev => ({ ...prev, minOptionPercent: Number(e.target.value) }))}
            style={{ width: '100%', padding: '6px 8px', marginTop: '4px' }}
          >
            {[5, 6, 7, 8, 9, 10].map((percent) => (
              <option key={percent} value={percent}>{percent}%</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.85rem' }}>SR 필수</label>
          <select
            value={input.srRequired ? 'required' : 'optional'}
            onChange={(e) => setInput(prev => ({ ...prev, srRequired: e.target.value === 'required' }))}
            style={{ width: '100%', padding: '6px 8px', marginTop: '4px' }}
          >
            <option value="optional">아님</option>
            <option value="required">필수</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.85rem' }}>목표 강화</label>
          <input
            type="number"
            value={input.targetEnhance}
            onChange={(e) => setInput(prev => ({ ...prev, targetEnhance: Number(e.target.value) }))}
            min={0}
            max={9}
            step={1}
            style={{ width: '100%', padding: '6px 8px', marginTop: '4px' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.85rem' }}>목표 등급</label>
          <select
            value={input.targetGrade}
            onChange={(e) => setInput(prev => ({ ...prev, targetGrade: e.target.value }))}
            style={{ width: '100%', padding: '6px 8px', marginTop: '4px' }}
          >
            {gradeOrder.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
          {isTargetCapped && (
            <div style={{ fontSize: '0.75rem', color: '#ffb74d', marginTop: '4px' }}>
              선택한 티어의 최대 등급은 {maxGrade}입니다. 시뮬레이션은 {maxGrade}까지 진행됩니다.
            </div>
          )}
        </div>
        <div>
          <label style={{ fontSize: '0.85rem' }}>시행 횟수 (최대 100000)</label>
          <input
            type="number"
            value={input.attempts}
            onChange={(e) => setInput(prev => ({ ...prev, attempts: Number(e.target.value) }))}
            min={1}
            max={100000}
            step={1}
            style={{ width: '100%', padding: '6px 8px', marginTop: '4px' }}
          />
        </div>
      </div>

      <button
        onClick={runSimulation}
        disabled={isRunning}
        style={{ padding: '10px 18px', backgroundColor: '#1976d2', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', marginBottom: '16px' }}
      >
        {isRunning ? '시뮬레이션 중...' : '시뮬레이션 실행'}
      </button>

      {result && (
        <>
          {(() => {
            const totalGained = result.stonesGained.low + result.stonesGained.mid + result.stonesGained.high;
            const totalSpent = result.stonesSpent.low + result.stonesSpent.mid + result.stonesSpent.high;
            const totalRemaining = result.stonesRemaining.low + result.stonesRemaining.mid + result.stonesRemaining.high;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div style={{ backgroundColor: '#1e1e1e', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#bbb' }}>총 시행 횟수</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{result.attempts.toLocaleString()}</div>
                </div>
                <div style={{ backgroundColor: '#1e1e1e', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#bbb' }}>옵션 조건 통과</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{(result.optionSelectedCount ?? 0).toLocaleString()}</div>
                </div>
                <div style={{ backgroundColor: '#1e1e1e', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#bbb' }}>총 강화 시도</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{(result.totalEnhanceAttempts ?? 0).toLocaleString()}</div>
                </div>
                <div style={{ backgroundColor: '#1e1e1e', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#bbb' }}>목표 강화 달성</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ef5350' }}>
                    {result.successEnhance.toLocaleString()}
                    <span style={{ fontSize: '0.85rem', color: '#ffccbc', marginLeft: '6px' }}>
                      (1/{Math.ceil(result.attempts / Math.max(1, result.successEnhance)).toLocaleString()})
                    </span>
                  </div>
                </div>
                <div style={{ backgroundColor: '#1e1e1e', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#bbb' }}>목표 등급 달성</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ffb74d' }}>
                    {result.successTarget.toLocaleString()}
                    <span style={{ fontSize: '0.85rem', color: '#ffe0b2', marginLeft: '6px' }}>
                      (1/{Math.ceil(result.attempts / Math.max(1, result.successTarget)).toLocaleString()})
                    </span>
                  </div>
                </div>
                <div style={{ backgroundColor: '#1e1e1e', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#bbb' }}>숯돌 총량</div>
                  <div style={{ fontSize: '0.85rem' }}>획득 {totalGained.toLocaleString()}</div>
                  <div style={{ fontSize: '0.85rem' }}>사용 {totalSpent.toLocaleString()}</div>
                  <div style={{ fontSize: '0.85rem' }}>잔여 {totalRemaining.toLocaleString()}</div>
                </div>
                <div style={{ backgroundColor: '#1e1e1e', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.85rem', color: '#bbb' }}>남은 숯돌 상세</div>
                  <div style={{ fontSize: '0.85rem' }}>하급 {result.stonesRemaining.low.toLocaleString()}</div>
                  <div style={{ fontSize: '0.85rem' }}>중급 {result.stonesRemaining.mid.toLocaleString()}</div>
                  <div style={{ fontSize: '0.85rem' }}>상급 {result.stonesRemaining.high.toLocaleString()}</div>
                </div>
              </div>
            );
          })()}

          <div style={{ marginBottom: '16px', backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px' }}>강화 단계 분포</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '0.8rem' }}>
              {(() => {
                const total = Object.values(result.stageCounts).reduce((sum, value) => sum + value, 0) || 1;
                return Object.keys(result.stageCounts)
                  .sort((a, b) => Number(b) - Number(a))
                  .map((stage) => {
                    const count = result.stageCounts[Number(stage)];
                    const percent = ((count / total) * 100).toFixed(1);
                    return (
                      <div key={stage} style={{ backgroundColor: '#2a2a2a', padding: '6px 10px', borderRadius: '6px' }}>
                        {stage}강: {count.toLocaleString()}개 ({percent}%)
                      </div>
                    );
                  });
              })()}
            </div>
          </div>

          <div style={{ height: '460px', backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '12px', overflow: 'hidden' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px' }}>
              강화 단계 분포 원형 그래프
            </div>
            {pieData && <Pie data={pieData} options={pieOptions} />}
          </div>

          <div style={{ height: '320px', backgroundColor: '#1e1e1e', borderRadius: '8px', padding: '12px', marginTop: '16px' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '8px' }}>
              강화 단계 그래프 (최대 1000개)
            </div>
            {barData && <Bar data={barData} options={barOptions} />}
          </div>
        </>
      )}
    </div>
  );
}
