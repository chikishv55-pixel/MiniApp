# Нарезка звуков «Перекуп Джо» из исходников BigSoundBank (CC0), см. public/games/flip/snd/README.md.
# Исходные mp3 скачать по ссылкам из README в папку SRC (имя — номер звука, например 0778.mp3), затем в Blender:
#   SRC = r"путь\к\исходникам"; exec(open(r"D:\MiniApp\scripts\flip\sounds.py", encoding="utf-8").read())
import aud, os

OUT = r"D:\MiniApp\public\games\flip\snd"
CUTS = {  # имя: (номер на bigsoundbank, начало, конец, обработка)
    "sponge": ("0778", 0.2, 4.0, None),
    "brush": ("1961", 6.3, 10.0, None),
    "spray": ("0048", 0.25, 1.15, None),
    "polish": ("1119", 30.0, 33.0, "polisher"),
    "coins": ("0193", 3.8, 4.9, None),
    "paper": ("1250", 1.3, 2.8, None),
    "door": ("0655", 0.15, 1.1, None),
}
LOOPS = ("sponge", "brush", "spray", "polish")
os.makedirs(OUT, exist_ok=True)
result = {}
for name, (src, a, b, fx) in CUTS.items():
    s = aud.Sound(os.path.join(SRC, src + ".mp3")).limit(a, b).rechannel(1)
    if fx == "polisher":  # болгарка -> мягче и ниже, как полировальная машинка
        s = s.lowpass(1800).pitch(0.85).volume(1.6)
    if name not in LOOPS:
        s = s.fadeout(b - a - 0.12, 0.12)
    path = os.path.join(OUT, name + ".mp3")
    s.write(path, 44100, aud.CHANNELS_MONO, aud.FORMAT_S16, aud.CONTAINER_MP3, aud.CODEC_MP3, 64000)
    result[name] = round(os.path.getsize(path) / 1024, 1)
