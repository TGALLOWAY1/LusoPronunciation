{
  "id": "sentence_001",
  "audio": {
    "ptbr": {
      "male": "audio/ptbr/male/sentence_001.wav",
      "female": "audio/ptbr/female/sentence_001.wav"
    }
  }
}


# Folder structure 
/data
  sentences.json
  words.json
  audio_index.json

/audio
  /ptbr
    /male
      sentence_001.wav
      sentence_002.wav
      word_001.wav
      ...
    /female
      sentence_001.wav
      sentence_002.wav
      word_001.wav
      ...


# Data model for sentnece and word entry 
type AudioId = string; // e.g. "sentence_001"

type Sentence = {
  id: string;
  categoryId: string;
  en: string;
  pt: string;
  // ...
  audioId: AudioId;  // points into audio_index.json
};

type Word = {
  id: string;
  categoryId: string;
  en: string;
  pt: string;
  // ...
  audioId: AudioId;
};
