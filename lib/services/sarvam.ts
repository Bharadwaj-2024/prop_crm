export interface SarvamTranscriptResult {
  transcript: string;
  language_code: string;
}

export async function transcribeAudioUrl(
  audioUrl: string
): Promise<SarvamTranscriptResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  console.log(`[transcribe] Downloading audio from: ${audioUrl}`);

  const audioResponse = await fetch(audioUrl, {
    headers: {
      Authorization: "Basic " + Buffer.from(
        `${process.env.EXOTEL_API_KEY}:${process.env.EXOTEL_API_TOKEN}`
      ).toString("base64"),
    },
  });

  if (!audioResponse.ok) {
    throw new Error(`[transcribe] Failed to download audio: ${audioResponse.status}`);
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  console.log(`[transcribe] Audio downloaded. Size: ${audioBuffer.byteLength} bytes. Sending to Groq Whisper...`);

  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: "audio/mpeg" }), "recording.mp3");
  form.append("model", "whisper-large-v3");
  form.append("language", "hi");
  form.append("response_format", "text");

  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[transcribe] Groq Whisper error ${response.status}: ${err}`);
  }

  const transcript = await response.text();
  console.log(`[transcribe] Transcription complete. Length: ${transcript.length} chars`);
  console.log(`[transcribe] Preview: ${transcript.slice(0, 150)}`);

  return { transcript, language_code: "hi-IN" };
}