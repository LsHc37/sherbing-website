'use client';

import { useEffect, useMemo, useState } from 'react';

type TaskId = 'lawn' | 'gutters' | 'weeds' | 'wash' | 'hedges';
type TaskStatus = 'pending' | 'active' | 'done';

type TaskConfig = {
  id: TaskId;
  label: string;
  detail: string;
  seconds: number;
};

const TASKS: TaskConfig[] = [
  { id: 'lawn', label: 'Lawn mowing', detail: 'Cut long grass and stripe the yard.', seconds: 10 },
  { id: 'gutters', label: 'Gutter cleaning', detail: 'Clear leaves and grime from gutters.', seconds: 9 },
  { id: 'weeds', label: 'Weed removal', detail: 'Pull and treat visible weed zones.', seconds: 8 },
  { id: 'wash', label: 'Exterior wash', detail: 'Pressure-wash dirty siding surfaces.', seconds: 10 },
  { id: 'hedges', label: 'Hedge trimming', detail: 'Shape overgrown hedges and edges.', seconds: 9 },
];

const TICK_MS = 120;

export default function HowItWorksExperience() {
  const [selected, setSelected] = useState<TaskId[]>(['lawn', 'gutters', 'weeds']);
  const [progress, setProgress] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const selectedTasks = useMemo(
    () => TASKS.filter((task) => selected.includes(task.id)),
    [selected],
  );

  const totalMs = useMemo(
    () => selectedTasks.reduce((sum, task) => sum + task.seconds * 1000, 0),
    [selectedTasks],
  );

  useEffect(() => {
    if (!isRunning || totalMs <= 0) {
      return;
    }

    const startedAt = Date.now() - (progress / 100) * totalMs;

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min(100, (elapsed / totalMs) * 100);
      setProgress(nextProgress);

      if (nextProgress >= 100) {
        setIsRunning(false);
      }
    }, TICK_MS);

    return () => window.clearInterval(timer);
  }, [isRunning, totalMs, progress]);

  const taskStatuses = useMemo<Record<TaskId, TaskStatus>>(() => {
    const statuses: Record<TaskId, TaskStatus> = {
      lawn: 'pending',
      gutters: 'pending',
      weeds: 'pending',
      wash: 'pending',
      hedges: 'pending',
    };

    if (selectedTasks.length === 0) {
      return statuses;
    }

    if (!isRunning && progress >= 100) {
      selectedTasks.forEach((task) => {
        statuses[task.id] = 'done';
      });
      return statuses;
    }

    const elapsedMs = (progress / 100) * totalMs;
    let cursor = 0;

    for (const task of selectedTasks) {
      const taskMs = task.seconds * 1000;
      const end = cursor + taskMs;

      if (elapsedMs >= end) {
        statuses[task.id] = 'done';
      } else if (elapsedMs >= cursor) {
        statuses[task.id] = 'active';
      }

      cursor = end;
    }

    return statuses;
  }, [isRunning, progress, selectedTasks, totalMs]);

  const activeTask = useMemo(() => {
    const found = selectedTasks.find((task) => taskStatuses[task.id] === 'active');
    return found?.id ?? null;
  }, [selectedTasks, taskStatuses]);

  const completedCount = selectedTasks.filter((task) => taskStatuses[task.id] === 'done').length;

  const toggleTask = (id: TaskId) => {
    if (isRunning) {
      return;
    }

    setProgress(0);
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  };

  const startDemo = () => {
    if (selectedTasks.length === 0) {
      return;
    }

    setProgress(0);
    setIsRunning(true);
  };

  const resetDemo = () => {
    setIsRunning(false);
    setProgress(0);
  };

  const done = !isRunning && progress >= 100 && selectedTasks.length > 0;

  return (
    <div className="how-shell mt-8 grid gap-7 xl:grid-cols-[1.08fr_0.92fr]">
      <section className="scene-card">
        <div className="scene-header">
          <p className="scene-kicker">Interactive home cleanup preview</p>
          <h2 className="scene-title">Pick tasks and watch your property transform</h2>
          <p className="scene-subtitle">
            Start with an overgrown, dirty house and see each selected service complete in sequence.
          </p>
        </div>

        <div
          className={[
            'house-scene',
            taskStatuses.lawn === 'done' ? 'lawn-done' : '',
            taskStatuses.gutters === 'done' ? 'gutters-done' : '',
            taskStatuses.weeds === 'done' ? 'weeds-done' : '',
            taskStatuses.wash === 'done' ? 'wash-done' : '',
            taskStatuses.hedges === 'done' ? 'hedges-done' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div className="sky-glow" />

          <div className="house-wrap">
            <div className="roof" />
            <div className="gutter-line" />
            <div className="house-front" />
            <div className="house-side" />
            <div className="grime-overlay" />
            <div className="door" />
            <div className="window window-left" />
            <div className="window window-right" />
          </div>

          <div className="hedge hedge-left" />
          <div className="hedge hedge-right" />
          <div className="yard" />
          <div className="weeds" />

          <div className={['worker', activeTask ? `worker-${activeTask}` : 'worker-idle'].join(' ')}>
            <span className="worker-head" />
            <span className="worker-body" />
            <span className="tool" />
          </div>
        </div>

        <div className="progress-strip">
          <div className="progress-labels">
            <span>Progress</span>
            <strong>{Math.round(progress)}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="status-text">
            {done
              ? 'All selected services complete. Your property is transformed.'
              : activeTask
                ? `Now working: ${TASKS.find((task) => task.id === activeTask)?.label}`
                : 'Select services and press Start Demo to preview the process.'}
          </p>
        </div>
      </section>

      <section className="control-card">
        <h3 className="control-title">Choose what your house needs</h3>
        <p className="control-subtitle">
          Customers can select one service or a complete package, then watch live progress before booking.
        </p>

        <div className="task-list" role="list" aria-label="Service selection">
          {TASKS.map((task) => {
            const isSelected = selected.includes(task.id);
            const status = taskStatuses[task.id];

            return (
              <button
                key={task.id}
                type="button"
                className={[
                  'task-row',
                  isSelected ? 'is-selected' : '',
                  status === 'active' ? 'is-active' : '',
                  status === 'done' ? 'is-done' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => toggleTask(task.id)}
                aria-pressed={isSelected}
                disabled={isRunning}
              >
                <div>
                  <p className="task-title">{task.label}</p>
                  <p className="task-detail">{task.detail}</p>
                </div>
                <span className="task-badge">
                  {status === 'done' ? 'Done' : status === 'active' ? 'Working' : isSelected ? 'Selected' : 'Off'}
                </span>
              </button>
            );
          })}
        </div>

        <div className="action-row">
          <button type="button" className="btn-primary" onClick={startDemo} disabled={isRunning || selectedTasks.length === 0}>
            {isRunning ? 'Running Demo' : done ? 'Run Again' : 'Start Demo'}
          </button>
          <button type="button" className="btn-secondary" onClick={resetDemo}>
            Reset
          </button>
        </div>

        <div className="summary-box">
          <p>
            Selected services: <strong>{selectedTasks.length}</strong>
          </p>
          <p>
            Completed: <strong>{completedCount}</strong>
          </p>
          <p>
            Estimated demo time: <strong>{Math.max(1, Math.round(totalMs / 1000))} sec</strong>
          </p>
        </div>
      </section>
    </div>
  );
}
