package com.guichaguri.trackplayer.audio;

import androidx.media3.common.C;
import androidx.media3.common.audio.BaseAudioProcessor;
import androidx.media3.common.util.UnstableApi;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/** Streaming RMS leveling, linked across channels, before the user's output volume.
 * Not an offline integrated-LUFS or true-peak mastering implementation.
 */
@UnstableApi
public final class LoudnessProcessor extends BaseAudioProcessor {
    private static final double TARGET_RMS = 0.12589254; // -18 dBFS
    private static final double PEAK_CEILING = 0.94406088; // -0.5 dBFS sample peak
    private static final double GATE_POWER = 0.00001; // -50 dBFS: don't raise silence
    private int channels;
    private int windowFrames;
    private int measuredFrames;
    private double energy;
    private double averagePower;
    private double targetGain = 1;
    private double gain = 1;
    private double limiter = 1;
    private double attack;
    private double release;
    private double limiterRelease;
    private boolean wasEnabled;

    @Override
    protected AudioFormat onConfigure(AudioFormat format) throws UnhandledAudioFormatException {
        if (format.encoding != C.ENCODING_PCM_16BIT) throw new UnhandledAudioFormatException(format);
        channels = format.channelCount;
        windowFrames = Math.max(1, format.sampleRate * 2 / 5);
        attack = 1 - Math.exp(-1.0 / (format.sampleRate * 0.12));
        release = 1 - Math.exp(-1.0 / (format.sampleRate * 3.0));
        limiterRelease = 1 - Math.exp(-1.0 / (format.sampleRate * 0.15));
        return format;
    }

    @Override
    protected void onFlush() {
        measuredFrames = 0;
        energy = averagePower = 0;
        targetGain = gain = limiter = 1;
        wasEnabled = LoudnessSettings.enabled;
    }

    @Override
    public void queueInput(ByteBuffer input) {
        input.order(ByteOrder.LITTLE_ENDIAN);
        int frameSize = channels * 2;
        int size = input.remaining() / frameSize * frameSize;
        ByteBuffer output = replaceOutputBuffer(size).order(ByteOrder.LITTLE_ENDIAN);
        boolean enabled = LoudnessSettings.enabled;
        if (enabled != wasEnabled) {
            measuredFrames = 0;
            energy = averagePower = 0;
            targetGain = 1;
            wasEnabled = enabled;
        }
        int end = input.position() + size;
        while (input.position() < end) {
            int start = input.position();
            double peak = 0;
            double power = 0;
            for (int channel = 0; channel < channels; channel++) {
                double sample = input.getShort() / 32768.0;
                peak = Math.max(peak, Math.abs(sample));
                power += sample * sample;
            }
            energy += power / channels;
            if (++measuredFrames >= windowFrames) {
                double blockPower = energy / measuredFrames;
                if (blockPower >= GATE_POWER) {
                    // About 8 seconds of music: avoid riding every beat or boosting quiet tails.
                    averagePower = averagePower == 0 ? blockPower : averagePower * 0.95 + blockPower * 0.05;
                    targetGain = Math.max(0.25, Math.min(4.0, TARGET_RMS / Math.sqrt(averagePower)));
                } else {
                    targetGain = Math.min(targetGain, 1);
                }
                measuredFrames = 0;
                energy = 0;
            }
            double desired = enabled ? targetGain : 1;
            gain += (desired - gain) * (desired < gain ? attack : release);
            double allowed = enabled && peak * gain > PEAK_CEILING ? PEAK_CEILING / (peak * gain) : 1;
            limiter = allowed < limiter ? allowed : limiter + (allowed - limiter) * limiterRelease;
            input.position(start);
            for (int channel = 0; channel < channels; channel++) {
                double sample = input.getShort() * gain * limiter;
                output.putShort((short) Math.max(-32768, Math.min(32767, Math.round(sample))));
            }
        }
        output.flip();
    }
}
