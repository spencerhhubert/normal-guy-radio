# Dev loop only. Mel spectrogram + loudness curve of one or more wavs, stacked, to eyeball against the reference.
#   python tools/spectro.py out.png a.wav [b.wav ...]
import sys, numpy as np, librosa, librosa.display, matplotlib, warnings
warnings.filterwarnings('ignore')
matplotlib.use('Agg')
import matplotlib.pyplot as plt
out, paths = sys.argv[1], sys.argv[2:]
fig, axes = plt.subplots(len(paths), 1, figsize=(16, 3.6 * len(paths)), squeeze=False)
for ax, p in zip(axes[:, 0], paths):
    y, sr = librosa.load(p, sr=22050, mono=True)
    S = librosa.power_to_db(librosa.feature.melspectrogram(y=y, sr=sr, n_mels=96, fmax=8000), ref=np.max)
    librosa.display.specshow(S, sr=sr, x_axis='time', y_axis='mel', fmax=8000, ax=ax, cmap='magma')
    rms = librosa.feature.rms(y=y)[0]; t = librosa.times_like(rms, sr=sr)
    ax2 = ax.twinx(); ax2.plot(t, rms, color='cyan', lw=0.8, alpha=0.8); ax2.set_ylim(0, 0.35); ax2.set_ylabel('rms', color='cyan')
    ax.set_title(p, fontsize=10)
plt.tight_layout(); plt.savefig(out, dpi=80)
print('wrote', out)
