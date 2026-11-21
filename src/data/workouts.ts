import type { Profile } from '../types';
export type Exercise = { name: string; reps: number; sets: number; instructions: string; easier: string };
export function workoutFor(day: number, p: Profile) {
  if (p.injuries.trim()) return { name: 'Movement plan needs review', strength: false, minutes: 0, exercises: [] as Exercise[],
    description: 'Use movements already cleared for your injury. Ask a clinician or physiotherapist to review exercise choices before starting a new strength routine.',
    caution: 'A reported injury changes the automatic schedule: strength prescriptions are paused until you update your limitations after professional review.' };
  const sessions = ['Rest & reset', 'Full-body foundations', 'Comfortable walk', 'Full-body foundations', 'Walk & mobility', 'Optional strength', 'Move your way'];
  const name = sessions[day];
  const strength = [1, 3, 5].includes(day);
  const minutes = p.experience === 'beginner' ? (strength ? 20 : 15) : 30;
  const exercises: Exercise[] = strength ? [
    { name: p.equipment === 'gym' ? 'Supported squat / light leg press' : 'Chair squat', reps: 8, sets: 2, instructions: 'Sit back toward a stable chair. Keep knees comfortable, press through your feet and stand slowly. Use light loads at the gym.', easier: 'Use a higher chair or hold a stable support.' },
    { name: p.equipment === 'gym' ? 'Light chest press' : 'Wall push-up', reps: 8, sets: 2, instructions: 'Keep your body aligned. Bend your elbows slowly, then press away. Breathe throughout.', easier: 'Stand closer to the wall.' },
    { name: 'Hip hinge', reps: 10, sets: 2, instructions: 'With a soft knee bend, push hips back while keeping your back comfortable. Stand tall slowly.', easier: 'Practise a short range of motion holding a support.' },
    ...(p.equipment !== 'none' ? [{ name: p.equipment === 'gym' ? 'Light seated row' : 'Band row', reps: 10, sets: 2, instructions: 'Use a secure anchor or supported machine. Draw elbows back without shrugging or holding your breath.', easier: 'Use less resistance and a shorter range.' }] : []),
    { name: 'Supported calf raise', reps: 12, sets: 2, instructions: 'Hold a stable surface. Lift heels slowly, pause, and lower with control.', easier: 'Try seated calf raises.' },
  ] : [];
  return { name, strength, minutes: day === 0 ? 0 : minutes, exercises,
    description: day === 0 ? 'Rest, or take a gentle stroll if you feel like it.' : strength ? 'Warm up gently for 3–5 minutes. Rest 60–90 seconds between sets. Finish feeling you could do a little more.' : 'Walk at a pace where you can hold a conversation. Split the time into shorter walks if needed.',
    caution: p.injuries || p.conditions ? 'You reported an injury or health condition. Review this general schedule with your clinician; skip any movement that causes pain.' : '',
  };
}
