import React, { useEffect, useState } from 'react';
import { Dumbbell, Loader2, Plus, Trash2 } from 'lucide-react';
import { useDashboard } from '../DashboardContext';
import {
  deleteGymTrainer,
  deleteGymWorkoutPlan,
  getGymTrainers,
  getGymWorkoutPlans,
  saveGymTrainer,
  saveGymWorkoutPlan,
} from '../../services/gymService';
import { GymTrainer, GymWorkoutPlan } from '../../types';

export const GymTrainersPage: React.FC = () => {
  const { shopId, isReadOnly } = useDashboard();
  const [trainers, setTrainers] = useState<GymTrainer[]>([]);
  const [workouts, setWorkouts] = useState<GymWorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tName, setTName] = useState('');
  const [tPhone, setTPhone] = useState('');
  const [tSpecialty, setTSpecialty] = useState('Strength & Conditioning');
  const [tShift, setTShift] = useState('Morning & Evening');

  const [wTitle, setWTitle] = useState('');
  const [wGoal, setWGoal] = useState('Fat Loss / Conditioning');
  const [wTrainerId, setWTrainerId] = useState('');
  const [wSchedule, setWSchedule] = useState('');

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const [t, w] = await Promise.all([
        getGymTrainers(shopId),
        getGymWorkoutPlans(shopId),
      ]);
      setTrainers(t);
      setWorkouts(w);
    } catch (err: any) {
      setError(err?.message || 'Failed to load trainers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [shopId]);

  const handleAddTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly) return;
    await saveGymTrainer(shopId, {
      name: tName,
      phone: tPhone,
      specialty: tSpecialty,
      shiftTiming: tShift,
    });
    setTName('');
    setTPhone('');
    await load();
  };

  const handleAddWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopId || isReadOnly) return;
    const trainer = trainers.find((t) => t.id === wTrainerId);
    await saveGymWorkoutPlan(shopId, {
      title: wTitle,
      goal: wGoal,
      trainerId: trainer?.id,
      trainerName: trainer?.name,
      scheduleSummary: wSchedule,
    });
    setWTitle('');
    setWSchedule('');
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Trainers &amp; Workout Plans</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Manage fitness coaches, shift schedules, and structured member workout routines.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center text-slate-500 gap-2 text-xs">
          <Loader2 className="w-5 h-5 animate-spin text-[#065F46]" /> Loading trainers &amp; workouts...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-[#065F46]" /> Gym Trainers
            </h3>
            {!isReadOnly && (
              <form onSubmit={handleAddTrainer} className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="text"
                  required
                  value={tName}
                  onChange={(e) => setTName(e.target.value)}
                  placeholder="Trainer Name *"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
                <input
                  type="tel"
                  required
                  value={tPhone}
                  onChange={(e) => setTPhone(e.target.value)}
                  placeholder="Phone *"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={tSpecialty}
                  onChange={(e) => setTSpecialty(e.target.value)}
                  placeholder="Specialty"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
                <input
                  type="text"
                  value={tShift}
                  onChange={(e) => setTShift(e.target.value)}
                  placeholder="Shift Timing"
                  className="px-3 py-2 border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  className="sm:col-span-2 py-2 bg-[#065F46] text-white rounded-lg font-bold inline-flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Trainer
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-100">
              {trainers.length === 0 ? (
                <p className="py-6 text-center text-slate-400">No trainers registered yet.</p>
              ) : (
                trainers.map((t) => (
                  <div key={t.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">{t.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {t.specialty} · {t.shiftTiming} · {t.phone}
                      </p>
                    </div>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => deleteGymTrainer(shopId, t.id).then(load)}
                        className="p-1.5 text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-slate-900">Workout Plans</h3>
            {!isReadOnly && (
              <form onSubmit={handleAddWorkout} className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={wTitle}
                    onChange={(e) => setWTitle(e.target.value)}
                    placeholder="Workout Plan Title *"
                    className="px-3 py-2 border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    required
                    value={wGoal}
                    onChange={(e) => setWGoal(e.target.value)}
                    placeholder="Goal (e.g. Hypertrophy)"
                    className="px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <select
                  value={wTrainerId}
                  onChange={(e) => setWTrainerId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">Assign Coach (Optional)</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <textarea
                  rows={2}
                  value={wSchedule}
                  onChange={(e) => setWSchedule(e.target.value)}
                  placeholder="Weekly split summary (e.g. Mon Push, Tue Pull, Wed Legs...)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-slate-900 text-white rounded-lg font-bold inline-flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Save Workout Plan
                </button>
              </form>
            )}
            <div className="divide-y divide-slate-100">
              {workouts.length === 0 ? (
                <p className="py-6 text-center text-slate-400">No workout plans created yet.</p>
              ) : (
                workouts.map((w) => (
                  <div key={w.id} className="py-2.5 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">
                        {w.title} <span className="text-slate-400 font-normal">· {w.goal}</span>
                      </p>
                      {w.trainerName && (
                        <p className="text-[11px] text-[#065F46]">Coach: {w.trainerName}</p>
                      )}
                      {w.scheduleSummary && (
                        <p className="text-[11px] text-slate-500 mt-0.5">{w.scheduleSummary}</p>
                      )}
                    </div>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => deleteGymWorkoutPlan(shopId, w.id).then(load)}
                        className="p-1.5 text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
