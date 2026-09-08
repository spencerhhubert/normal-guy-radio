# Dev loop only. Prints the same feature set for a wav that was used to characterize the reference clip,
# so a render can be compared number for number: tempo, key, harmonic/percussive balance, band energies,
# spectral centroid, onset density, loudness over time.
#   python tools/analyze.py renders/seed1-60s.wav
import sys, numpy as np, librosa, warnings
warnings.filterwarnings('ignore')
path = sys.argv[1]
y, sr = librosa.load(path, sr=22050, mono=True)
dur = len(y) / sr
print(f"{path}: {dur:.1f}s")
onset_env = librosa.onset.onset_strength(y=y, sr=sr)
tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
print(f"tempo {float(np.atleast_1d(tempo)[0]):.1f} bpm")
y_h, y_p = librosa.effects.hpss(y)
chroma = librosa.feature.chroma_cqt(y=y_h, sr=sr).mean(axis=1)
names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
maj = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
mino = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])
scores = sorted([(np.corrcoef(np.roll(maj, i), chroma)[0, 1], names[i] + ' major') for i in range(12)] + [(np.corrcoef(np.roll(mino, i), chroma)[0, 1], names[i] + ' minor') for i in range(12)], reverse=True)
print("key:", [(n, round(float(s), 2)) for s, n in scores[:3]])
eh, ep = float(np.sum(y_h ** 2)), float(np.sum(y_p ** 2))
print(f"harmonic/percussive energy ratio {eh / ep:.2f}   (reference 11.1)")
cent = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
roll = librosa.feature.spectral_rolloff(y=y, sr=sr, roll_percent=0.85)[0]
flat = librosa.feature.spectral_flatness(y=y)[0]
rms = librosa.feature.rms(y=y)[0]
print(f"centroid mean {cent.mean():.0f} Hz p10 {np.percentile(cent, 10):.0f} p90 {np.percentile(cent, 90):.0f}   (reference 2015 / 1267 / 2772)")
print(f"rolloff85 {roll.mean():.0f} Hz (ref 4595); flatness {flat.mean():.4f} (ref 0.0106)")
print(f"rms mean {rms.mean():.3f} std {rms.std():.3f} max {rms.max():.3f}  (ref 0.139 / 0.052 / 0.242); crest {np.abs(y).max() / np.sqrt(np.mean(y ** 2)):.2f} (ref 3.94)")
onsets = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, units='time')
print(f"onsets {len(onsets) / dur:.2f}/s (ref 3.62)")
S = np.abs(librosa.stft(y, n_fft=2048)) ** 2
freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
tot = S.sum()
ref = {'sub': 14.0, 'bass': 62.9, 'lowmid': 12.4, 'mid': 7.9, 'presence': 2.2, 'air': 0.6}
for lo, hi, name in [(0, 80, 'sub'), (80, 250, 'bass'), (250, 500, 'lowmid'), (500, 2000, 'mid'), (2000, 5000, 'presence'), (5000, 11025, 'air')]:
    m = (freqs >= lo) & (freqs < hi)
    print(f"  band {name:8s} {100 * S[m].sum() / tot:5.1f}%   (ref {ref[name]:5.1f}%)")
step = 4
print("rms per %ds:" % step, np.round([rms[int(i * sr / 512):int((i + step) * sr / 512)].mean() for i in range(0, int(dur), step)], 3))
