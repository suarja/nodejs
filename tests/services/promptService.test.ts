it("dummy", () => expect(true).toBe(true));

const { PromptService } = require("../../src/services/promptService");

describe("PromptService", () => {
  const promptId = "video-creatomate-agent-v2";

  it("remplit correctement les placeholders avec toutes les valeurs", () => {
    const values = {
      prompt: "Créer une vidéo TikTok sur la productivité",
      systemPrompt: "Optimise pour le format verticalement",
      editorialProfile: "Dynamique, jeune, motivant",
      captionConfig: { presetId: "karaoke", placement: "bottom", lines: 2 },
      outputLanguage: "fr",
    };
    const filled = PromptService.fillPromptTemplate(promptId, values);
    expect(filled).not.toBeNull();
    expect(filled?.system).toContain(values.outputLanguage);
    expect(filled?.user).toContain(values.prompt);
    expect(filled?.user).toContain("verticalement");
    expect(filled?.user).toContain("karaoke");
    expect(filled?.user).toContain("fr");
    expect(filled?.developer).toContain("caption configuration");
  });

  it("laisse le placeholder si la valeur est manquante", () => {
    const values = {
      prompt: "Créer une vidéo",
      // Pas de outputLanguage fourni
    };
    const filled = PromptService.fillPromptTemplate(promptId, values);
    expect(filled).not.toBeNull();
    // Le placeholder {outputLanguage} doit rester dans le texte
    expect(filled?.user).toContain("{outputLanguage}");
  });

  it("gère les objets imbriqués comme valeurs", () => {
    const values = {
      prompt: "Créer une vidéo",
      outputLanguage: "fr",
      captionConfig: { presetId: "beasty", placement: "top", lines: 3 },
    };
    const filled = PromptService.fillPromptTemplate(promptId, values);
    expect(filled).not.toBeNull();
    // L'objet doit être stringifié dans le prompt
    expect(filled?.user).toContain("beasty");
    expect(filled?.user).toContain("top");
    expect(filled?.user).toContain("3");
  });

  it("retourne null si le promptId est inconnu", () => {
    const filled = PromptService.fillPromptTemplate("unknown-prompt", {
      foo: "bar",
    });
    expect(filled).toBeNull();
  });

  // it("gère un prompt sans champ developer", () => {
  //   // On utilise un prompt qui n'a pas de champ developer (ex: prompt-enhancer-agent)
  //   const filled = PromptService.fillPromptTemplate("prompt-enhancer-agent", {
  //     userInput: "Parle de la créativité",
  //     outputLanguage: "fr",
  //   });
  //   expect(filled).not.toBeNull();
  //   expect(filled?.developer).toBeUndefined();
  //   expect(filled?.system).toContain("script");
  //   expect(filled?.user).toContain("créativité");
  // });
});
