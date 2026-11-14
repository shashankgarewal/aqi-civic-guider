import React, { useRef } from 'react';
import {
  Building2,
  GraduationCap,
  HardHat,
  HeartPulse,
  Plus,
  ShieldAlert,
  Sparkles,
  TrafficCone,
} from 'lucide-react';
import type {
  AdvisoryLanguage,
  BuiltInPersona,
  ReadingLevel,
} from '../types/airQuality';

interface BriefingConfigBarProps {
  selectedBuiltInPersona: BuiltInPersona;
  onSelectBuiltInPersona: (p: BuiltInPersona) => void;
  isCustomPersona: boolean;
  onToggleCustomPersona: (enabled: boolean) => void;
  customPersonaText: string;
  onCustomPersonaTextChange: (val: string) => void;
  language: AdvisoryLanguage;
  onLanguageChange: (l: AdvisoryLanguage) => void;
  readingLevel: ReadingLevel;
  onReadingLevelChange: (r: ReadingLevel) => void;
  cityOrArea: string;
  onCityOrAreaChange: (v: string) => void;
  rowCount: number;
  isAnalyzing: boolean;
  onGenerate: () => void;
}

const PERSONA_OPTIONS: Array<{
  value: BuiltInPersona;
  label: string;
  scope: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: 'Ward Officer',
    label: 'Ward Officer',
    scope: 'Road sprinkling, C&D bans, traffic rerouting, anti-burning drives',
    icon: ShieldAlert,
  },
  {
    value: 'Housing Society / RWA',
    label: 'Housing Society / RWA',
    scope: 'HEPA lobbies, wet mopping, civil work halts, DG set & clean rooms',
    icon: Building2,
  },
  {
    value: 'School Administrator',
    label: 'School Administrator',
    scope: 'Outdoor PE/assembly holds, classroom air, inhalers, hybrid shifts',
    icon: GraduationCap,
  },
  {
    value: 'Hospital / Clinic Chief',
    label: 'Hospital / Clinic Chief',
    scope:
      'Respiratory triage readiness, OPD surge alerts, ICU/ward air filtration, ambulance staging',
    icon: HeartPulse,
  },
  {
    value: 'Construction Site Manager',
    label: 'Construction Site Manager',
    scope:
      'Anti-smog guns, green-net shrouding, material covering, excavation/demolition halts',
    icon: HardHat,
  },
  {
    value: 'Transit & Traffic Police',
    label: 'Transit & Traffic Police',
    scope:
      'Signal synchronization, heavy vehicle diversion, idle-engine checks, commuter advisories',
    icon: TrafficCone,
  },
];

const LANGUAGES: AdvisoryLanguage[] = [
  'English',
  'Hindi',
  'Marathi',
  'Bengali',
  'Tamil',
];

const READING_LEVELS: ReadingLevel[] = [
  'Simple / Grade 5 (Easy-to-read community poster)',
  'Standard Public Notice',
];

export const BriefingConfigBar: React.FC<BriefingConfigBarProps> = ({
  selectedBuiltInPersona,
  onSelectBuiltInPersona,
  isCustomPersona,
  onToggleCustomPersona,
  customPersonaText,
  onCustomPersonaTextChange,
  language,
  onLanguageChange,
  readingLevel,
  onReadingLevelChange,
  cityOrArea,
  onCityOrAreaChange,
  rowCount,
  isAnalyzing,
  onGenerate,
}) => {
  const customInputRef = useRef<HTMLInputElement | null>(null);
  const customMissingText = isCustomPersona && !customPersonaText.trim();

  const handleClickCustom = () => {
    onToggleCustomPersona(true);
    setTimeout(() => customInputRef.current?.focus(), 0);
  };

  return (
    <section
      id="configuration"
      className="bg-white border border-slate-200 rounded-xl"
    >
      <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            02. Briefing Configuration & Target Persona
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Select operational authority (or define a custom role), citizen
            bulletin script, and community reading level before generating.
          </p>
        </div>

        <div className="text-xs font-mono text-slate-600 tabular-nums">
          {rowCount > 0
            ? `${rowCount} traceable rows staged`
            : 'No input rows staged'}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Persona Selector: 6 built-in roles in responsive 3-column grid + 7th Custom Persona card */}
        <div>
          <span className="block text-xs font-medium text-slate-700 mb-2">
            Target Operational Persona
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {PERSONA_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected =
                !isCustomPersona && selectedBuiltInPersona === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onToggleCustomPersona(false);
                    onSelectBuiltInPersona(opt.value);
                  }}
                  className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                    selected
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        selected ? 'text-blue-300' : 'text-slate-600'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{opt.label}</span>
                  </div>
                  <p
                    className={`text-xs mt-1.5 leading-relaxed ${
                      selected ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    {opt.scope}
                  </p>
                </button>
              );
            })}

            {/* 7th Card: + Custom Persona / Role */}
            <div
              onClick={() => {
                if (!isCustomPersona) handleClickCustom();
              }}
              className={`md:col-span-2 lg:col-span-3 p-4 rounded-lg border transition-colors ${
                isCustomPersona
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : 'bg-slate-50 border-dashed border-slate-300 text-slate-900 hover:bg-slate-100 cursor-pointer'
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClickCustom();
                }}
                className="w-full text-left flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Plus
                    className={`w-4 h-4 shrink-0 ${
                      isCustomPersona ? 'text-blue-300' : 'text-slate-700'
                    }`}
                    aria-hidden="true"
                  />
                  <span>+ Custom Persona / Role</span>
                </div>
                <span
                  className={`text-xs ${
                    isCustomPersona ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  Define any custom municipal, facility, or community role
                </span>
              </button>

              {isCustomPersona && (
                <div className="mt-3">
                  <label htmlFor="custom-persona-input" className="sr-only">
                    Custom Persona Role Title and Operational Scope
                  </label>
                  <input
                    ref={customInputRef}
                    id="custom-persona-input"
                    type="text"
                    value={customPersonaText}
                    onChange={(e) => onCustomPersonaTextChange(e.target.value)}
                    placeholder="Enter role title & operational scope, e.g., Municipal Park Caretaker, Industrial Estate Safety Officer, or Senior Care Home Manager"
                    className="w-full px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-400 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Context, Language & Reading Level Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-3">
            <label
              htmlFor="city-area-label"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              City / Ward / Campus Label
            </label>
            <input
              id="city-area-label"
              type="text"
              value={cityOrArea}
              onChange={(e) => onCityOrAreaChange(e.target.value)}
              placeholder="e.g. Delhi East Ward-14"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="advisory-lang"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Citizen Language
            </label>
            <select
              id="advisory-lang"
              value={language}
              onChange={(e) =>
                onLanguageChange(e.target.value as AdvisoryLanguage)
              }
              className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-4">
            <span className="block text-xs font-medium text-slate-700 mb-1.5">
              Citizen Reading Level
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              {READING_LEVELS.map((lvl) => {
                const isSimple = lvl.startsWith('Simple');
                const active = readingLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onReadingLevelChange(lvl)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate cursor-pointer ${
                      active
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title={lvl}
                  >
                    {isSimple ? 'Simple / Grade 5' : 'Standard Public Notice'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-3 flex justify-end">
            <button
              type="button"
              onClick={onGenerate}
              disabled={isAnalyzing || rowCount === 0 || customMissingText}
              className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-500 rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              {isAnalyzing ? 'Auditing & Generating...' : 'Generate Briefing'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
