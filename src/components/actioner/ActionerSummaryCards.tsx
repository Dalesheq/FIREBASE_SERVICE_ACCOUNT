import React from 'react';
import { Action } from '../../types/sheq';
import { isActionOverdue } from '../../utils/validation';
import { ClipboardList, Clock, PlayCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ActionerSummaryCardsProps {
  actions: Action[];
  selectedFilter: string;
  onSelectFilter: (filter: string) => void;
}

export const ActionerSummaryCards: React.FC<ActionerSummaryCardsProps> = ({
  actions,
  selectedFilter,
  onSelectFilter,
}) => {
  const total = actions.length;
  const openCount = actions.filter((a) => a.status === 'Open').length;
  const inProgressCount = actions.filter((a) => a.status === 'In Progress').length;
  const completedCount = actions.filter((a) => a.status === 'Completed').length;
  const overdueCount = actions.filter((a) => isActionOverdue(a.dueDate, a.status)).length;

  const cards = [
    {
      id: 'all',
      title: 'Total Actions',
      count: total,
      icon: ClipboardList,
      color: 'text-slate-800',
      bgColor: 'bg-slate-50',
      activeBorder: 'border-slate-800 ring-2 ring-slate-800/20',
      badgeBg: 'bg-slate-100 text-slate-700',
    },
    {
      id: 'Open',
      title: 'Open',
      count: openCount,
      icon: Clock,
      color: 'text-sky-700',
      bgColor: 'bg-sky-50/50',
      activeBorder: 'border-sky-600 ring-2 ring-sky-600/20',
      badgeBg: 'bg-sky-100 text-sky-800',
    },
    {
      id: 'In Progress',
      title: 'In Progress',
      count: inProgressCount,
      icon: PlayCircle,
      color: 'text-amber-700',
      bgColor: 'bg-amber-50/50',
      activeBorder: 'border-amber-600 ring-2 ring-amber-600/20',
      badgeBg: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'Completed',
      title: 'Completed',
      count: completedCount,
      icon: CheckCircle2,
      color: 'text-emerald-700',
      bgColor: 'bg-emerald-50/50',
      activeBorder: 'border-emerald-600 ring-2 ring-emerald-600/20',
      badgeBg: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'Overdue',
      title: 'Overdue',
      count: overdueCount,
      icon: AlertTriangle,
      color: 'text-red-700',
      bgColor: overdueCount > 0 ? 'bg-red-50' : 'bg-slate-50',
      activeBorder: 'border-red-600 ring-2 ring-red-600/20',
      badgeBg: overdueCount > 0 ? 'bg-red-100 text-red-800 font-bold' : 'bg-slate-100 text-slate-600',
    },
  ];

  return (
    <div id="actioner-summary-cards" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedFilter === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectFilter(card.id)}
            className={`text-left p-4 rounded-xl border transition-all duration-150 cursor-pointer ${card.bgColor} ${
              isSelected ? card.activeBorder : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {card.title}
              </span>
              <Icon className={`h-4 w-4 ${card.color}`} />
            </div>
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${card.color}`}>
                {card.count}
              </span>
              {isSelected && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Active
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
