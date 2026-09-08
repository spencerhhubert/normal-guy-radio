# Dev tool. Builds samples/<instrument>.js from the gleitz MusyngKite -mp3.js files (fetched into a
# directory given as argv[2]; default ./sf): keeps each instrument's useful register, and only every other
# semitone for pads and chord instruments (the engine pitch-shifts a semitone with no audible cost), which
# halves load time and decoded memory.
#   python tools/trim-samples.py samples sf
import re, json, os, sys
NAMES = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
def midi(n):
    m = re.match(r'([A-G]b?)(\d)', n); return NAMES.index(m.group(1)) + 12*(int(m.group(2))+1)
ranges = {
 'whistle': ('C4','C7'), 'french_horn': ('F2','F5'), 'string_ensemble_1': ('C2','C7'),
 'pizzicato_strings': ('C2','C6'), 'orchestral_harp': ('C2','C7'), 'choir_aahs': ('C3','C6'),
 'clarinet': ('D3','G6'), 'bassoon': ('Bb1','C5'), 'tuba': ('D1','F3'), 'electric_piano_1': ('C2','C7'),
 'rock_organ': ('C2','C7'), 'electric_guitar_muted': ('E2','E6'), 'electric_bass_finger': ('E1','G3'),
 'glockenspiel': ('C5','C8'), 'muted_trumpet': ('E3','C6'),
}
outdir = sys.argv[1]; sfdir = sys.argv[2] if len(sys.argv) > 2 else 'sf'; os.makedirs(outdir, exist_ok=True)
EVERY_OTHER = {'string_ensemble_1', 'choir_aahs', 'rock_organ', 'french_horn', 'orchestral_harp', 'electric_piano_1', 'pizzicato_strings', 'tuba', 'bassoon'}
total = 0
for inst,(lo,hi) in ranges.items():
    s = open(os.path.join(sfdir, f'{inst}-mp3.js')).read()
    pairs = re.findall(r'"([A-G]b?\d)": "data:audio/mp3;base64,([^"]+)"', s)
    keep = {n: d for n,d in pairs if midi(lo) <= midi(n) <= midi(hi) and (inst not in EVERY_OTHER or midi(n) % 2 == 0)}
    js = 'window.SF=window.SF||{};window.SF[%s]=%s;' % (json.dumps(inst), json.dumps(keep, separators=(',',':')))
    p = os.path.join(outdir, inst + '.js'); open(p,'w').write(js); total += len(js)
    print(f"{inst:22s} {len(keep):3d} notes {len(js)/1e6:.2f} MB")
print('total MB', total/1e6)
