const MIDI_OUT_NOTE = {
    'windows:toggle': 67,
    'windows:randomize': 68,
    'streetlamps:toggle': 70,
    'aviation:toggle': 71,
    'windows:flicker': 72,
    'streetlamp:flicker2': 73,
    // gate sketch
    'gate:toggle': 65,
    'text:toggle': 66,
};
const MIDI_OUT_CC = {
    'fog:set': 20,
    'time:set': 21,
    'windows:dim:set': 22,
};

let midiOut = null;

function setStatus(msg, isError = false) {
    const el = document.getElementById('midi-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? '#e07070' : '#70d090';
}

function pickOutput(midi) {
    const outputs = [...midi.outputs.values()];
    midiOut = outputs.find(o => /IAC/i.test(o.name)) || outputs[0] || null;
    if (midiOut) setStatus('MIDI out: ' + midiOut.name);
    else setStatus('no MIDI outputs found', true);
}

if (!navigator.requestMIDIAccess) {
    setStatus('WebMIDI not supported in this browser', true);
} else {
    navigator.requestMIDIAccess({ sysex: false }).then(midi => {
        pickOutput(midi);
        midi.onstatechange = () => pickOutput(midi);
    }).catch(err => {
        setStatus('MIDI access denied: ' + err.message, true);
    });
}

function send(cmd, value) {
    if (!midiOut) {
        console.warn('no MIDI output ready, dropped:', cmd);
        return;
    }
    if (cmd in MIDI_OUT_NOTE) {
        const note = MIDI_OUT_NOTE[cmd];
        midiOut.send([0x90, note, 100]);
        midiOut.send([0x80, note, 0], performance.now() + 50);
    } else if (cmd in MIDI_OUT_CC) {
        const cc = MIDI_OUT_CC[cmd];
        const v = Math.max(0, Math.min(127, Math.round((value ?? 0) * 127)));
        midiOut.send([0xB0, cc, v]);
    } else {
        console.warn('unknown cmd:', cmd);
    }
}
