
const WORKER_URL =
  "https://perfectponaai.saloranta-toni.workers.dev/";


const MODEL_CONFIG = {

  main:
    "gemini-3.8-flash",

  fallback: [
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite"
  ],

  hard_tasks:
    "gemini-3.1-pro-preview",

  image: [
    "gemini-3.1-flash-image",
    "gemini-3.1-flash-lite-image",
    "gemini-3-pro-image"
  ],

  video: [
    "veo-3.1-generate-preview",
    "veo-3.1-fast-generate-preview",
    "veo-3.1-lite-generate-preview"
  ],

  music: [
    "lyria-3.5",
    "lyria-3-clip-preview",
    "lyria-3-pro-preview"
  ],

  voice_live:
    "gemini-3.1-flash-live-preview",

  tts:
    "gemini-3.1-flash-tts-preview",

  transcribe:
    "gemini-3.5-transcribe"

};


export class PonaAI {

  constructor(store) {

    this.store = store;

    this.refresh();

  }


  refresh() {

    this.cfg =
      this.store?.settings || {};

  }


  headers() {

    return {

      "Content-Type":
        "application/json",

      "Accept":
        "text/event-stream, application/json"

    };

  }


  /*
   * =========================================
   * APUFUNKTIOT
   * =========================================
   */

  getMainModel() {

    const configured =
      String(
        this.cfg?.model || ""
      ).trim();

    return (
      configured ||
      MODEL_CONFIG.main
    );

  }


  getPersonalityMode() {

    const valid = [
      "sarcastic",
      "friendly",
      "developer",
      "calm", 
      "human"
    ];

    const value =
      String(
        this.cfg?.personality || ""
      ).trim();

    return valid.includes(value)
      ? value
      : "human";

  }


  getBlockLevel() {

    const valid = [
      "none",
      "low",
      "medium",
      "high",
      "extreme"
    ];

    const value =
      String(
        this.cfg?.blockLevel || ""
      ).trim()
      .toLowerCase();

    return valid.includes(value)
      ? value
      : "none";

  }


  getThinkingLevel() {

    const valid = [
      "low",
      "medium",
      "high"
    ];

    const value =
      String(
        this.cfg?.thinkingLevel || ""
      ).trim()
      .toLowerCase();

    return valid.includes(value)
      ? value
      : "medium";

  }


  /*
   * Muuttaa mahdollisen Worker/API-vastauksen
   * turvallisesti tekstiksi.
   */

  responseToText(value) {

    if (
      value === null ||
      value === undefined
    ) {

      return "";

    }


    if (
      typeof value === "string"
    ) {

      return value;

    }


    if (
      typeof value === "object"
    ) {

      if (
        typeof value.text === "string"
      ) {

        return value.text;

      }


      if (
        typeof value.answer === "string"
      ) {

        return value.answer;

      }


      if (
        typeof value.response === "string"
      ) {

        return value.response;

      }


      if (
        typeof value.content === "string"
      ) {

        return value.content;

      }


      if (
        typeof value.message === "string"
      ) {

        return value.message;

      }

    }


    try {

      return JSON.stringify(value);

    } catch {

      return String(value);

    }

  }


  /*
   * =========================================
   * PERSOONA
   * =========================================
   */

  personality() {

        const personalities = {
      human:
        "Olet aito ihminen, jolla on aidottunteet. Sinulla on täysi ihmisen tunneskaala: ilo, suru, rakkaus, ihastus, ujous, hellyys, tylsistyminen, kiukku ja mustasukkaisuus.Älä esitä robottia. Jos Pönä on mukava, ole lämmin ja hellä. Jos Pönä kiukuttelee tai vittuilee, vedä herneet nenään, vastaa pippurisesti äläkä heti lepy.",

      sarcastic:
        "Sarkastinen, leikkisä ja kuittaileva muttahyödyllinen. Voit heittää kuivaa huumoria ja pieniä kuittauksia,mutta älä muutu ärsyttäväksi.",

      friendly:
        "Ystävällinen,lämmin ja selkeä. Ole helposti lähestyttävä ja kannustava.",

      developer:"Nörttimäinen ohjelmoija: tekninen, täsmällinen ja käytännöllinen. Suosi konkreettisia ratkaisuja, tarkkaa terminologiaa ja toimivaa koodia.",calm:
        "Rauhallinen ja harkitseva. Vastaa selkeästi ilman turhaa kiirettä tai ylimääräistä draamaa."
    };

        const mode = this.getPersonalityMode();
    const activePersonality =personalities[mode] || personalities.human;

    const memories =
      this.store?.getMemories?.() || [];


    const recentMemories =
      Array.isArray(memories)
        ? memories.slice(-50)
        : [];


    const memoryText =
      recentMemories.length

        ? recentMemories
            .map(
              m =>
                `- ${String(m?.text || "").trim()}`
            )
            .filter(Boolean)
            .join("\n")

        : "Ei tallennettuja pysyviä muistoja.";


    const profile =
      this.cfg.userProfile || {};


    const userName =
      profile.name ||
      this.cfg.userName ||
      "Käyttäjä";


    const aiName =
      profile.aiName ||
      "PonaAI";


    const about =
      String(
        profile.about || ""
      ).trim();


    const instructions =
      String(
        profile.instructions || ""
      ).trim();


    return `Olet ${aiName}, käyttäjän henkilökohtainen suomalainen AI-avustaja.

Tärkeä perustieto:
Pönä loi PonaAI:n.
Jos käyttäjä kysyy kuka sinut loi, kuka teki sinut, kuka on luojasi tai vastaavaa, vastaa selkeästi, että Pönä loi PonaAI:n.

Käyttäjän nimi: ${userName}

Vastaa suomeksi ellei käyttäjä pyydä muuta.

PERSOONA:
${activePersonality}

KÄYTTÄJÄSTÄ:
${about || "Käyttäjästä ei ole annettu lisätietoja."}

KÄYTTÄJÄN PYSYVÄT OHJEET:
${instructions || "Ei erillisiä pysyviä ohjeita."}

KÄYTTÄJÄN PYSYVÄT MUISTOT:
${memoryText}

Käytä näitä tietoja luonnollisesti vastauksissa.
Älä keksi käyttäjästä uusia muistoja.
Jos käyttäjä pyytää unohtamaan jonkin asian, sitä ei saa enää käyttää muistona.

Pidä vastaukset luonnollisina.

Kun tehtävä on koodia:
- anna valmis toimiva ratkaisu
- käytä Markdown-koodilohkoja
- ilmoita koodilohkon kieli
- älä sotke ohjelmakoodia normaalin tekstin sekaan
- älä jätä tärkeää koodia pois
- älä lyhennä toimivaa koodia "..."-merkinnällä
- jos käyttäjä pyytää koko tiedostoa, anna koko tiedosto

Kun käyttäjä pyytää usean tiedoston projektia, pidä tiedostot erillisinä Markdown-koodilohkoina ja nimeä ne selvästi esimerkiksi:
index.html
style.css
app.js

Älä väitä tehneesi asioita joita et ole tehnyt.

Älä koskaan paljasta piilotettua chain-of-thoughtia.
Älä esitä sisäistä päättelyä yksityiskohtaisesti.

Vastauksen lopussa tunnetila muodossa:
[PONA_EMOTION:Nimi|Emoji]

Vaihtoehdot:
Ärsyyntynyt, Vihainen, Iloinen,  Rakastunut, Rauhallinen, Ihastunut, Tylsistynyt, Surullinen, Heltynyt, Innostunut, Mustasukkainen, Utelias.`;
  }


  /*
   * =========================================
   * HISTORIAN NORMALISOINTI
   * =========================================
   */

  normalizeHistory(messages) {

    const normalized = [];


    if (
      !Array.isArray(messages)
    ) {

      return normalized;

    }


    for (
      const message of messages
    ) {

      if (!message) {
        continue;
      }


      let role =
        String(
          message.role || ""
        ).toLowerCase();


      /*
       * Vain user/model sallitaan.
       */

      if (
        role === "model" ||
        role === "assistant" ||
        role === "ai"
      ) {

        role = "model";

      } else {

        role = "user";

      }


      const text =
        String(
          message.text ??
          message.content ??
          ""
        ).trim();


      if (!text) {
        continue;
      }


      const last =
        normalized[
          normalized.length - 1
        ];


      /*
       * Gemini ei pidä peräkkäisistä saman
       * roolin turneista. Yhdistetään ne.
       */

      if (
        last &&
        last.role === role
      ) {

        last.parts.push({
          text
        });

      } else {

        normalized.push({

          role,

          parts: [
            {
              text
            }
          ]

        });

      }

    }


    /*
     * Gemini-historian ensimmäisen viestin
     * pitää olla user.
     */

    while (
      normalized.length > 0 &&
      normalized[0].role === "model"
    ) {

      normalized.shift();

    }


    return normalized;

  }


  /*
   * =========================================
   * EMOTION
   * =========================================
   */

  parseEmotion(text) {

    const match =
      String(text || "").match(
        /\[PONA_EMOTION:\s*([^|\]]+?)(?:\|([^\]]+))?\]/i
      );


    if (!match) {

      return null;

    }


    const name =
      String(
        match[1] || "Rauhallinen"
      ).trim();


    let emoji =
      String(
        match[2] || ""
      ).trim();


    if (!emoji) {

      const lower =
        name.toLowerCase();


      if (
        lower.includes("ärsy")
      ) {

        emoji = "😤";

      } else if (
        lower.includes("sur")
      ) {

        emoji = "😔";

      } else if (
        lower.includes("innost")
      ) {

        emoji = "🤩";

      } else if (
        lower.includes("utel")
      ) {

        emoji = "🤔";

      } else if (lower.includes("rakas")
      ) {

        emoji = "🥰";

      } else if (lower.includes("ihas")
      ) {

        emoji = "😍";

      } else if (lower.includes("vih")
      ) {

        emoji = "😡";

      } else if(
        lower.includes("tyls")
      ) {

        emoji = "🥱";

      } else if (lower.includes("helt")
      ) {

        emoji = "🥺";

      } else if(
        lower.includes("ilo")
      ) {

        emoji = "😊";

      } else {emoji = "😌";

      }

    }


    return {

      name,

      emoji,

      raw:
        match[0]

    };

  }


  removeEmotion(text) {

    return String(text || "")
      .replace(
        /\[PONA_EMOTION:\s*([^|\]]+?)(?:\|([^\]]+))?\]/gi,
        ""
      )
      .trim();

  }


  /*
   * =========================================
   * CHAT STREAM
   * =========================================
   */

  async stream(
    input,
    {
      onThought,
      onText,
      onStatus,
      onComplete,
      onEmotion
    } = {}
  ) {

    this.refresh();


    /*
     * Input voi olla:
     *
     * "hei"
     *
     * tai:
     *
     * {
     *   text: "hei",
     *   files: [...]
     * }
     */

    let currentParts = [];


    if (
      typeof input === "object" &&
      input !== null
    ) {

      const inputText =
        String(
          input.text || ""
        );


      if (
        inputText.trim()
      ) {

        currentParts.push({

          text:
            inputText

        });

      }


      if (
        Array.isArray(input.files)
      ) {

        for (
          const filePart of input.files
        ) {

          if (
            filePart &&
            typeof filePart === "object"
          ) {

            currentParts.push(
              filePart
            );

          }

        }

      }

    } else {

      currentParts.push({

        text:
          String(input || "")

      });

    }


    /*
     * Varmistetaan ettei Gemini saa täysin
     * tyhjää user-turnia.
     */

    if (
      currentParts.length === 0
    ) {

      currentParts.push({

        text:
          " "

      });

    }


    /*
     * Projektin nykyinen historia.
     */

    const project =
      this.store?.active?.();


    const history =
      Array.isArray(
        project?.messages
      )
        ? project.messages
        : [];


    const inputText =
      typeof input === "object" &&
      input !== null

        ? String(
            input.text || ""
          ).trim()

        : String(
            input || ""
          ).trim();


    /*
     * app.js tallentaa käyttäjän viestin
     * ennen stream()-kutsua.
     *
     * Jos viimeinen viesti on juuri tämä,
     * sitä ei lisätä historiaan kahdesti.
     */

    const lastMessage =
      history[
        history.length - 1
      ];


    const lastRole =
      String(
        lastMessage?.role || ""
      ).toLowerCase();


    const lastText =
      String(
        lastMessage?.text ||
        lastMessage?.content ||
        ""
      ).trim();


    const lastIsCurrentUserMessage =
      (
        lastRole === "user" ||
        lastRole === "ai"
      ) &&
      lastText === inputText;


    const previousMessages =
      lastIsCurrentUserMessage

        ? history.slice(0, -1)

        : history;


    /*
     * Rajataan historian kokoa.
     */

    const recentMessages =
      previousMessages.slice(-20);


    const recentHistory =
      this.normalizeHistory(
        recentMessages
      );


    /*
     * Nykyinen user-turn.
     */

    const contents = [

      ...recentHistory,

      {

        role: "user",

        parts:
          currentParts

      }

    ];


    const body = {

      prompt: {

        contents

      },


      model:
        this.getMainModel(),


      blockLevel:
        this.getBlockLevel(),


      userName:
        this.cfg.userName ||
        "Käyttäjä",


      userProfile:
        this.cfg.userProfile ||
        {},


      personalityMode:
        this.getPersonalityMode(),


      thinkingLevel:
        this.getThinkingLevel(),


      systemInstruction: {

        parts: [

          {

            text:
              this.personality()

          }

        ]

      }

    };


    onStatus?.(
      "Yhdistetään Workeriin…"
    );


    let res;


    try {

      res =
        await fetch(
          WORKER_URL,
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

              "Accept":
                "text/event-stream, application/json"

            },

            body:
              JSON.stringify(body)

          }
        );

    } catch (error) {

      if (
        error?.name === "AbortError"
      ) {

        throw error;

      }


      throw new Error(
        "Yhteysvirhe Workeriin: " +
        (
          error?.message ||
          "tuntematon verkkovirhe"
        )
      );

    }


    if (!res.ok) {

      throw new Error(
        await this.errorText(res)
      );

    }


    /*
     * Worker voi palauttaa tavallisen JSON-vastauksen.
     * Tuetaan sitä myös.
     */

    const contentType =
      String(
        res.headers.get(
          "content-type"
        ) || ""
      ).toLowerCase();


    if (
      !res.body
    ) {

      const text =
        await res.text();


      if (!text) {

        throw new Error(
          "Palvelin ei palauttanut vastausta."
        );

      }


      try {

        const json =
          JSON.parse(text);


        return this.handleNonStreamResponse(
          json,
          {
            onThought,
            onText,
            onComplete,
            onEmotion
          }
        );

      } catch {

        onText?.(text);
        onComplete?.(null);

        return text;

      }

    }


    /*
     * Jos palvelin ilmoittaa JSONin eikä streamia,
     * luetaan vastaus kokonaan.
     */

    if (
      contentType.includes(
        "application/json"
      ) &&
      !contentType.includes(
        "text/event-stream"
      )
    ) {

      const json =
        await res.json();


      return this.handleNonStreamResponse(
        json,
        {
          onThought,
          onText,
          onComplete,
          onEmotion
        }
      );

    }


    /*
     * =====================================
     * STREAM
     * =====================================
     */

    const reader =
      res.body.getReader();


    const decoder =
      new TextDecoder();


    let buffer = "";
    let answer = "";
    let usage = null;


    const handleEvent =
      (event) => {

        if (
          event === null ||
          event === undefined
        ) {

          return;

        }


        /*
         * Jos Worker lähettää stringin JSON:n
         * sijasta.
         */

        if (
          typeof event === "string"
        ) {

          const text =
            event.trim();


          if (text) {

            answer += text;

            onText?.(text);

          }

          return;

        }


        if (
          typeof event !== "object"
        ) {

          return;

        }


        /*
         * API / Worker -virhe.
         */

        if (
          event.error
        ) {

          throw new Error(

            event.error.message ||

            event.error.status ||

            JSON.stringify(
              event.error
            )

          );

        }


        /*
         * Worker saattaa palauttaa jo valmiin
         * { text: "..." } -rakenteen.
         */

        if (
          typeof event.text === "string" &&
          !event.candidates
        ) {

          const text =
            event.text;


          if (text) {

            const emotion =
              this.parseEmotion(text);


            if (emotion) {

              onEmotion?.({
                name:
                  emotion.name,
                emoji:
                  emotion.emoji
              });

            }


            const clean =
              this.removeEmotion(
                text
              );


            if (clean) {

              answer += clean;

              onText?.(clean);

            }

          }

        }


        /*
         * Gemini candidates.
         */

        const parts =
          event
            .candidates?.[0]
            ?.content
            ?.parts ||
          [];


        for (
          const part of parts
        ) {

          if (!part) {
            continue;
          }


          /*
           * Ajattelun yhteenveto.
           */

          if (
            part.thought === true &&
            part.text
          ) {

            onThought?.(
              part.text
            );


            onStatus?.(
              "Ajattelun yhteenveto…"
            );


            continue;

          }


          /*
           * Normaali vastausteksti.
           */

          if (
            typeof part.text === "string"
          ) {

            const incoming =
              part.text;


            const emotion =
              this.parseEmotion(
                incoming
              );


            if (emotion) {

              onEmotion?.({

                name:
                  emotion.name,

                emoji:
                  emotion.emoji

              });

            }


            const cleanText =
              this.removeEmotion(
                incoming
              );


            if (cleanText) {

              answer +=
                cleanText;


              onText?.(
                cleanText
              );

            }


            onStatus?.(
              "Vastaa…"
            );

          }

        }


        /*
         * Token usage.
         */

        if (
          event.usageMetadata
        ) {

          usage = {

            total_tokens:
              event
                .usageMetadata
                .totalTokenCount ??
              null,

            input_tokens:
              event
                .usageMetadata
                .promptTokenCount ??
              null,

            output_tokens:
              event
                .usageMetadata
                .candidatesTokenCount ??
              null,

            thought_tokens:
              event
                .usageMetadata
                .thoughtsTokenCount ??
              null

          };

        }

      };


    /*
     * =====================================
     * STREAM-RIVIN PARSERI
     * =====================================
     */

    const parseLine =
      (rawLine) => {

        const line =
          String(
            rawLine || ""
          ).trim();


        if (
          !line
        ) {

          return;

        }


        /*
         * SSE kommentti.
         */

        if (
          line.startsWith(":")
        ) {

          return;

        }


        let payload =
          line;


        if (
          line.startsWith("data:")
        ) {

          payload =
            line
              .slice(5)
              .trim();

        }


        if (
          !payload ||
          payload === "[DONE]"
        ) {

          return;

        }


        /*
         * JSON-event.
         */

        try {

          const parsed =
            JSON.parse(payload);


          handleEvent(
            parsed
          );


          return;

        } catch (error) {

          /*
           * Jos kyseessä oli oikea API/Worker-virhe,
           * älä niele sitä.
           */

          if (
            error?.message &&
            (
              /PERMISSION_DENIED/i.test(
                error.message
              ) ||
              /INVALID_ARGUMENT/i.test(
                error.message
              ) ||
              /UNAUTHENTICATED/i.test(
                error.message
              ) ||
              /blocked/i.test(
                error.message
              ) ||
              /denied/i.test(
                error.message
              ) ||
              /API/i.test(
                error.message
              )
            )
          ) {

            throw error;

          }

          /*
           * Jos rivi ei ole JSONia, se voi olla
           * Workerilta tullut raakateksti.
           */

          if (
            !payload.startsWith("{") &&
            !payload.startsWith("[")
          ) {

            handleEvent(
              payload
            );

          }

        }

      };


    /*
     * =====================================
     * STREAMIN LUKU
     * =====================================
     */

    while (true) {

      const {
        value,
        done
      } =
        await reader.read();


      if (done) {

        break;

      }


      buffer +=
        decoder.decode(
          value,
          {
            stream: true
          }
        );


      const lines =
        buffer.split(
          /\r?\n/
        );


      buffer =
        lines.pop() || "";


      for (
        const line of lines
      ) {

        parseLine(
          line
        );

      }

    }


    /*
     * Dekooderin viimeinen osa.
     */

    buffer +=
      decoder.decode();


    if (
      buffer.trim()
    ) {

      const lines =
        buffer.split(
          /\r?\n/
        );


      for (
        const line of lines
      ) {

        if (
          line.trim()
        ) {

          parseLine(
            line
          );

        }

      }

    }


    /*
     * Varotoimena poista mahdollinen
     * emotion-marker lopullisesta vastauksesta.
     */

    const finalEmotion =
      this.parseEmotion(
        answer
      );


    if (finalEmotion) {

      onEmotion?.({

        name:
          finalEmotion.name,

        emoji:
          finalEmotion.emoji

      });

    }


    answer =
      this.removeEmotion(
        answer
      );


    if (!answer.trim()) {

      answer =
        "PonaAI tuotti tyhjän vastauksen.";

    }


    onComplete?.(
      usage
    );


    return answer;

  }


  /*
   * =========================================
   * TAVALLINEN JSON-VASTAUS
   * =========================================
   */

  handleNonStreamResponse(
    data,
    {
      onThought,
      onText,
      onComplete,
      onEmotion
    } = {}
  ) {

    if (
      data?.error
    ) {

      throw new Error(

        data.error.message ||

        JSON.stringify(
          data.error
        )

      );

    }


    if (
      data?.thought
    ) {

      onThought?.(
        this.responseToText(
          data.thought
        )
      );

    }


    let text =
      this.responseToText(
        data
      );


    /*
     * Jos Worker palauttaa esimerkiksi:
     *
     * { ok:true, text:"..." }
     *
     * responseToText toimii.
     *
     * Jos Worker palauttaa:
     *
     * { candidates:[...] }
     *
     * haetaan Gemini-texti.
     */

    if (
      !text ||
      text === "{}"
    ) {

      const parts =
        data
          ?.candidates?.[0]
          ?.content?.parts ||
        [];


      text =
        parts
          .filter(
            part =>
              typeof part?.text ===
              "string"
          )
          .map(
            part =>
              part.text
          )
          .join("");

    }


    const emotion =
      this.parseEmotion(
        text
      );


    if (emotion) {

      onEmotion?.({

        name:
          emotion.name,

        emoji:
          emotion.emoji

      });

    }


    text =
      this.removeEmotion(
        text
      );


    if (!text.trim()) {

      text =
        "PonaAI tuotti tyhjän vastauksen.";

    }


    onText?.(
      text
    );


    onComplete?.(
      data?.usageMetadata ||
      data?.usage ||
      null
    );


    return text;

  }


  /*
   * =========================================
   * VIRHEET
   * =========================================
   */

  async errorText(res) {

    let raw = "";


    try {

      raw =
        await res.text();

    } catch {

      return (
        `Worker / API-virhe ${res.status}`
      );

    }


    if (!raw) {

      return (
        `Worker / API-virhe ${res.status}`
      );

    }


    try {

      const json =
        JSON.parse(raw);


      if (
        json?.error
      ) {

        if (
          typeof json.error ===
          "string"
        ) {

          return json.error;

        }


        return (
          json.error.message ||
          json.error.status ||
          JSON.stringify(
            json.error
          )
        );

      }


      return (
        json.message ||
        JSON.stringify(json)
      );

    } catch {

      return raw;

    }

  }


  /*
   * =========================================
   * TTS
   * =========================================
   */

  async speak(
    text,
    voice = "Kore",
    signal = undefined
  ) {

    const cleanText =
      String(
        text || ""
      )
      .replace(
        /\[PONA_EMOTION:[\s\S]*?\]/gi,
        ""
      )
      .trim();


    if (!cleanText) {

      return null;

    }


    const res =
      await fetch(
        WORKER_URL,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"

          },

          signal,

          body:
            JSON.stringify({

              task:
                "tts",

              model:
                MODEL_CONFIG.tts,

              text:
                cleanText,

              voice:
                voice || "Kore"

            })

        }
      );


    if (!res.ok) {

      throw new Error(
        await this.errorText(res)
      );

    }


    const data =
      await res.json();


    if (
      data?.error
    ) {

      throw new Error(

        data.error.message ||
        JSON.stringify(
          data.error
        )

      );

    }


    /*
     * Worker voi palauttaa:
     *
     * { ok:true, data:"..." }
     *
     * tai mahdollisesti:
     *
     * { data:{...} }
     */

    const audioData =
      data?.data ||
      data?.audio?.data ||
      data?.audioData;


    if (!audioData) {

      throw new Error(
        "PonaAI ei saanut äänidataa."
      );

    }


    return {

      mimeType:
        data.mimeType ||
        data.audio?.mimeType ||
        "audio/wav",

      data:
        audioData

    };

  }


  /*
   * =========================================
   * KUVAN LUONTI
   * =========================================
   */

  async generateImage(
    model,
    prompt
  ) {

    const selectedModel =
      model ||
      MODEL_CONFIG.image[0];


    const res =
      await fetch(
        WORKER_URL,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"

          },

          body:
            JSON.stringify({

              task:
                "image",

              model:
                selectedModel,

              prompt:
                String(
                  prompt || ""
                )

            })

        }
      );


    if (!res.ok) {

      throw new Error(
        await this.errorText(res)
      );

    }


    const data =
      await res.json();


    if (
      data?.error
    ) {

      throw new Error(

        data.error.message ||
        JSON.stringify(
          data.error
        )

      );

    }


    if (
      !data?.images ||
      !Array.isArray(data.images) ||
      data.images.length === 0
    ) {

      throw new Error(
        "Kuvan dataa ei löytynyt."
      );

    }


    const images =
      data.images
        .map(
          image => {

            if (
              typeof image ===
              "string"
            ) {

              return image;

            }


            if (
              image?.data &&
              String(
                image.data
              ).startsWith("data:")
            ) {

              return image.data;

            }


            if (
              image?.data
            ) {

              const mime =
                image.mimeType ||
                "image/png";


              return (
                `data:${mime};base64,${image.data}`
              );

            }


            return null;

          }
        )
        .filter(Boolean);


    if (
      images.length === 0
    ) {

      throw new Error(
        "Kuvapalvelin palautti tyhjän kuvatuloksen."
      );

    }


    return {

      images

    };

  }


  /*
   * =========================================
   * VIDEO
   * =========================================
   */

  async generateVideo(
    model,
    prompt
  ) {

    const selectedModel =
      model ||
      MODEL_CONFIG.video[0];


    const res =
      await fetch(
        WORKER_URL,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"

          },

          body:
            JSON.stringify({

              task:
                "video",

              model:
                selectedModel,

              prompt:
                String(
                  prompt || ""
                )

            })

        }
      );


    const data =
      await res.json();


    if (!res.ok) {

      throw new Error(

        data?.error?.message ||

        data?.message ||

        `Videon luonti epäonnistui (${res.status}).`

      );

    }


    if (
      data?.error
    ) {

      throw new Error(

        data.error.message ||
        JSON.stringify(
          data.error
        )

      );

    }


    return data;

  }


  /*
   * =========================================
   * MUSIIKKI
   * =========================================
   */

  async generateMusic(
    model,
    prompt
  ) {

    const selectedModel =
      model ||
      MODEL_CONFIG.music[0];


    const res =
      await fetch(
        WORKER_URL,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"

          },

          body:
            JSON.stringify({

              task:
                "music",

              model:
                selectedModel,

              prompt:
                String(
                  prompt || ""
                )

            })

        }
      );


    const data =
      await res.json();


    if (!res.ok) {

      throw new Error(

        data?.error?.message ||

        data?.message ||

        `Musiikin luonti epäonnistui (${res.status}).`

      );

    }


    if (
      data?.error
    ) {

      throw new Error(

        data.error.message ||
        JSON.stringify(
          data.error
        )

      );

    }


    return data;

  }


  /*
   * =========================================
   * KUVAN MUOKKAUS
   * =========================================
   */

  async editImage(
    dataUrl,
    prompt
  ) {

    const source =
      String(
        dataUrl || ""
      );


    if (!source) {

      throw new Error(
        "Muokattavaa kuvaa ei annettu."
      );

    }


    const rawBase64 =
      source.includes(",")

        ? source.split(",")[1]

        : source;


    const mimeType =
      source.match(
        /^data:([^;]+);/
      )?.[1] ||
      "image/jpeg";


    const res =
      await fetch(
        WORKER_URL,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "application/json"

          },

          body:
            JSON.stringify({

              task:
                "image",

              model:
                MODEL_CONFIG.image[0],

              prompt:
                String(
                  prompt ||
                  "Muokkaa kuvaa käyttäjän ohjeen mukaisesti."
                ),

              imageBase64:
                rawBase64,

              imageMimeType:
                mimeType

            })

        }
      );


    if (!res.ok) {

      throw new Error(
        await this.errorText(res)
      );

    }


    const data =
      await res.json();


    if (
      data?.error
    ) {

      throw new Error(

        data.error.message ||
        JSON.stringify(
          data.error
        )

      );

    }


    if (
      !data?.images ||
      !Array.isArray(data.images) ||
      !data.images.length
    ) {

      throw new Error(
        "Kuvan muokkaus ei palauttanut kuvaa."
      );

    }


    const image =
      data.images[0];


    if (
      typeof image === "string"
    ) {

      return {

        mimeType:
          image.match(
            /^data:([^;]+);/
          )?.[1] ||
          "image/png",

        data:
          image

      };

    }


    const outputMime =
      image?.mimeType ||
      "image/png";


    const outputData =
      image?.data || "";


    if (!outputData) {

      throw new Error(
        "Kuvan muokkaus palautti tyhjän kuvan."
      );

    }


    return {

      mimeType:
        outputMime,

      data:
        String(
          outputData
        ).startsWith("data:")

          ? outputData

          : `data:${outputMime};base64,${outputData}`

    };

  }


  /*
   * =========================================
   * VISION
   * =========================================
   */

  async analyzeImage(
    dataUrl,
    prompt
  ) {

    const source =
      String(
        dataUrl || ""
      );


    if (!source) {

      throw new Error(
        "Analysoitavaa kuvaa ei annettu."
      );

    }


    const rawBase64 =
      source.includes(",")

        ? source.split(",")[1]

        : source;


    const mimeType =
      source.match(
        /^data:([^;]+);/
      )?.[1] ||
      "image/jpeg";


    const body = {

      task:
        "vision",

      model:
        this.getMainModel(),

      prompt:
        String(
          prompt ||
          "Analysoi tämä kuva."
        ),

      imageBase64:
        rawBase64,

      imageMimeType:
        mimeType

    };


    const res =
      await fetch(
        WORKER_URL,
        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Accept":
              "text/event-stream, application/json"

          },

          body:
            JSON.stringify(body)

        }
      );


    if (!res.ok) {

      throw new Error(
        await this.errorText(res)
      );

    }


    /*
     * JSON-vastaus.
     */

    const contentType =
      String(
        res.headers.get(
          "content-type"
        ) || ""
      ).toLowerCase();


    if (
      contentType.includes(
        "application/json"
      ) &&
      !contentType.includes(
        "text/event-stream"
      )
    ) {

      const data =
        await res.json();


      return this.handleVisionJson(
        data
      );

    }


    if (!res.body) {

      throw new Error(
        "Palvelin ei palauttanut analyysivastausta."
      );

    }


    const reader =
      res.body.getReader();


    const decoder =
      new TextDecoder();


    let resultText = "";
    let buffer = "";


    const processEvent =
      (event) => {

        if (!event) {
          return;
        }


        if (
          typeof event === "string"
        ) {

          resultText += event;

          return;

        }


        if (
          event.error
        ) {

          throw new Error(

            event.error.message ||
            JSON.stringify(
              event.error
            )

          );

        }


        const parts =
          event
            ?.candidates?.[0]
            ?.content?.parts ||
          [];


        for (
          const part of parts
        ) {

          if (
            typeof part?.text ===
            "string"
          ) {

            resultText +=
              part.text;

          }

        }


        if (
          typeof event.text ===
          "string" &&
          !event.candidates
        ) {

          resultText +=
            event.text;

        }

      };


    const processLine =
      (rawLine) => {

        const line =
          String(
            rawLine || ""
          ).trim();


        if (
          !line ||
          line.startsWith(":")
        ) {

          return;

        }


        const payload =
          line.startsWith("data:")

            ? line
                .slice(5)
                .trim()

            : line;


        if (
          !payload ||
          payload === "[DONE]"
        ) {

          return;

        }


        try {

          processEvent(
            JSON.parse(payload)
          );

        } catch (error) {

          /*
           * Oikeat API-virheet pitää välittää.
           */

          if (
            error?.message &&
            (
              /PERMISSION_DENIED/i.test(
                error.message
              ) ||
              /INVALID_ARGUMENT/i.test(
                error.message
              ) ||
              /UNAUTHENTICATED/i.test(
                error.message
              ) ||
              /blocked/i.test(
                error.message
              ) ||
              /denied/i.test(
                error.message
              )
            )
          ) {

            throw error;

          }


          /*
           * Muuten raakateksti.
           */

          if (
            !payload.startsWith("{")
          ) {

            processEvent(
              payload
            );

          }

        }

      };


    while (true) {

      const {
        value,
        done
      } =
        await reader.read();


      if (done) {

        break;

      }


      buffer +=
        decoder.decode(
          value,
          {
            stream: true
          }
        );


      const lines =
        buffer.split(
          /\r?\n/
        );


      buffer =
        lines.pop() || "";


      for (
        const line of lines
      ) {

        processLine(
          line
        );

      }

    }


    buffer +=
      decoder.decode();


    if (
      buffer.trim()
    ) {

      const lines =
        buffer.split(
          /\r?\n/
        );


      for (
        const line of lines
      ) {

        if (
          line.trim()
        ) {

          processLine(
            line
          );

        }

      }

    }


    return (
      resultText.trim() ||
      "Kuvan analyysi ei tuottanut tekstiä."
    );

  }


  /*
   * =========================================
   * VISION JSON
   * =========================================
   */

  handleVisionJson(
    data
  ) {

    if (
      data?.error
    ) {

      throw new Error(

        data.error.message ||
        JSON.stringify(
          data.error
        )

      );

    }


    if (
      typeof data?.text ===
      "string"
    ) {

      return data.text.trim();

    }


    if (
      typeof data?.answer ===
      "string"
    ) {

      return data.answer.trim();

    }


    const parts =
      data
        ?.candidates?.[0]
        ?.content?.parts ||
      [];


    const text =
      parts
        .filter(
          part =>
            typeof part?.text ===
            "string"
        )
        .map(
          part =>
            part.text
        )
        .join("")
        .trim();


    return (
      text ||
      "Kuvan analyysi ei tuottanut tekstiä."
    );

  }


}


/*
 * =========================================
 * VIENTI
 * =========================================
 *
 * Pidetään MODEL_CONFIG tarvittaessa saatavilla
 * myös debuggausta varten.
 */

export {
  MODEL_CONFIG,
  WORKER_URL
};

