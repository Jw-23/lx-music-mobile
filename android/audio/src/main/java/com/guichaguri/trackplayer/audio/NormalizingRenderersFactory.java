package com.guichaguri.trackplayer.audio;

import android.content.Context;
import androidx.media3.common.Format;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.audio.AudioSink;
import androidx.media3.exoplayer.audio.DefaultAudioSink;
import androidx.media3.exoplayer.audio.ForwardingAudioSink;

@UnstableApi
public final class NormalizingRenderersFactory extends DefaultRenderersFactory {
    public NormalizingRenderersFactory(Context context) {
        super(context);
        LoudnessSettings.load(context);
    }

    @Override
    protected AudioSink buildAudioSink(Context context, boolean floatOutput, boolean playbackParams) {
        AudioSink sink = new DefaultAudioSink.Builder(context)
                .setEnableFloatOutput(false)
                .setEnableAudioTrackPlaybackParams(false)
                .setAudioProcessors(new AudioProcessor[] { new LoudnessProcessor() })
                .build();
        // Encoded passthrough/offload skips PCM processors. Always decode so toggles work live.
        return new ForwardingAudioSink(sink) {
            @Override
            public boolean supportsFormat(Format format) {
                return MimeTypes.AUDIO_RAW.equals(format.sampleMimeType) && super.supportsFormat(format);
            }

            @Override
            public int getFormatSupport(Format format) {
                return MimeTypes.AUDIO_RAW.equals(format.sampleMimeType)
                        ? super.getFormatSupport(format) : SINK_FORMAT_UNSUPPORTED;
            }
        };
    }
}
