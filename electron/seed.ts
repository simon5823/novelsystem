import { id, nowIso } from "../shared/text.ts";
import type { Session } from "./project.ts";

export function seedEmpty(session: Session, name: string): void {
  const t = nowIso();
  session.pf.setMeta("id", id());
  session.pf.setMeta("name", name);
  session.pf.setMeta("created_at", t);
  session.pf.setMeta("updated_at", t);
  session.pf.setMeta("timeline_mode", "relative");
  session.pf.setMeta("word_count_mode", "no_space");
  const cats: [string, string, number][] = [
    ["etiquette", "禮儀", 1],
    ["livelihood", "民生", 2],
    ["faction", "勢力", 3],
    ["location", "地點", 4],
    ["rules", "規則體系", 5],
    ["other", "其他", 6],
  ];
  for (const [key, nameZh, order] of cats) {
    session.pf.run("INSERT INTO world_categories(id,key,name,enabled,sort_order) VALUES(?,?,?,1,?)", [
      id(),
      key,
      nameZh,
      order,
    ]);
  }
  session.pf.run("INSERT INTO time_points(id,sort_key,label,notes) VALUES(?,?,?, '')", [id(), 1000, "開篇"]);
  session.createVolume("第一卷");
}

export function seedDemo(session: Session): void {
  seedEmpty(session, "青雲殘卷（驗收示範）");
  session.pf.setMeta("name", "青雲殘卷（驗收示範）");

  const tp0 = session.pf.one<{ id: string }>("SELECT id FROM time_points ORDER BY sort_key LIMIT 1")!.id;
  const tp1 = session.createTimePoint({ label: "夜探山門", after_id: tp0 });
  const tp2 = session.createTimePoint({ label: "決裂之後", after_id: tp1 });

  const volumes = session.pf.all<{ id: string }>("SELECT id FROM volumes ORDER BY sort_order");
  const vol1 = volumes[0].id;
  const part2 = session.createPart("第二部");
  const vol2 = session.pf.one<{ id: string }>("SELECT id FROM volumes WHERE part_id = ? ORDER BY sort_order", [
    part2,
  ])!.id;
  session.updateVolume({ id: vol2, title: "第一卷" });

  const chA = session.pf.one<{ id: string }>(
    "SELECT id FROM chapters WHERE volume_id = ? AND deleted_at IS NULL ORDER BY sort_order",
    [vol1],
  )!.id;
  session.updateChapter({ id: chA, title: "山門夜雨", summary: "林三夜探青雲，得知師門隱密。" });
  const chB = session.createChapter(vol1, "師徒對質");
  session.updateChapter({ id: chB, summary: "趙四逼問林三來意。" });
  const chC = session.pf.one<{ id: string }>(
    "SELECT id FROM chapters WHERE volume_id = ? AND deleted_at IS NULL ORDER BY sort_order",
    [vol2],
  )!.id;
  session.updateChapter({ id: chC, title: "下山", summary: "林三攜秘密離山。" });

  const factionId = session.createFaction({
    name: "青雲門",
    summary: "據青雲山，以劍修聞名。",
    hierarchy_notes: "掌門—長老—內門—外門",
  });
  const locId = session.createLocation({
    name: "青雲山門",
    summary: "雲海之上的石階與殿宇。",
    controlling_faction_id: factionId,
  });
  session.createEtiquette({
    name: "師門問安",
    context: "師門私見",
    from_role: "弟子",
    to_role: "師尊",
    required: "稱「師尊」，先行一揖，不得直呼其名。",
    forbidden: "對師尊稱「你」。",
    consequence: "視為犯上，當眾罰跪。",
  });
  session.createLivelihood({
    title: "山門齋飯",
    body: "內門弟子卯時用齋，外門則在下院。銀錢以「雲票」計，一雲票約當山下銅錢百文。",
    location_id: locId,
    faction_id: factionId,
  });

  const sysId = session.createRuleSystem({
    name: "青雲劍道",
    kind: "cultivation",
    summary: "以劍意通脈，忌以內力凌轢凡人。",
  });
  const rank1 = session.addRank({ system_id: sysId, name: "練氣" });
  const rank2 = session.addRank({ system_id: sysId, name: "築基" });
  void rank2;
  session.addConstraint({
    system_id: sysId,
    statement: "練氣期不得在凡人面前顯露劍光。",
    applies_to: "練氣",
    violation_note: "破格者劍心受損，情節寫成破功亦可。",
  });

  const lin = session.createCharacter({
    name: "林三",
    gender: "男",
    age: "19",
    status_title: "外門弟子",
    faction_id: factionId,
    personality: "隱忍、重諾，話少。",
    speech_pattern: "短句，少用文言套語，對師長必稱師尊。",
    goals: "查明師兄之死。",
    appearance: "青布袍，左眉一道淺疤。",
  });
  const zhao = session.createCharacter({
    name: "趙四",
    gender: "男",
    age: "41",
    status_title: "內門長老",
    faction_id: factionId,
    personality: "嚴厲、極重門規，對外門弟子刻薄。",
    speech_pattern: "好用「放肆」「聽着」。",
    goals: "掩蓋叛徒身份，維持青雲門清譽。",
    appearance: "蒼白長鬚，常着玄色鶴氅。",
  });

  session.pf.run(
    "UPDATE character_states SET location_id = ?, rank_id = ? WHERE character_id = ?",
    [locId, rank1, lin],
  );

  session.addRelationship({
    from_id: lin,
    to_id: zhao,
    type: "master_disciple",
    label: "名義師尊",
    start_time_id: tp0,
    notes: "林三外門掛名，趙四很少親自授課。",
  });
  session.addRelationship({
    from_id: zhao,
    to_id: lin,
    type: "master_disciple",
    label: "記名弟子",
    start_time_id: tp0,
  });

  const factSecret = session.createFact({
    statement: "趙四即是害死林三師兄的叛徒。",
    about_ids: [zhao, lin],
    is_secret: 1,
    true_in_canon: 1,
  });
  const factPublic = session.createFact({
    statement: "青雲門禁止外門弟子夜探藏經閣。",
    about_ids: [factionId],
    is_secret: 0,
  });
  session.addKnowledge({
    character_id: lin,
    fact_id: factSecret,
    learned_at_time_id: tp1,
    believed: 1,
  });
  session.addKnowledge({
    character_id: zhao,
    fact_id: factSecret,
    learned_at_time_id: tp0,
    believed: 1,
  });
  session.addKnowledge({
    character_id: lin,
    fact_id: factPublic,
    learned_at_time_id: tp0,
    believed: 1,
  });

  const thread = session.createThread({
    name: "藏經閣的血書",
    type: "foreshadow",
    status: "planted",
    summary: "林三在夾頁中看見半張血書。",
  });
  session.addBeat({
    thread_id: thread,
    kind: "plant",
    time_point_id: tp1,
    summary: "夜雨中，夾頁露出半個「趙」字。",
  });
  session.createThread({
    name: "查明師兄死因",
    type: "main",
    status: "active",
    summary: "林三的主線。",
  });
  session.createAddressRule({
    speaker_spec: lin,
    addressee_spec: zhao,
    term: "師尊",
    formality: "high",
    notes: "弟子對趙四。",
  });

  const body = `山門的雨是斜的，打在青石階上像碎玉。

林三把外門的青布袍襟口勒緊，貼着側廊往藏經閣走。他不該來。門規寫得明白：外門弟子夜探藏經閣，杖三十，逐出師門。

可師兄的棺是空的。

閣裡只剩一盞長明燈。他翻到一本無人借閱的劍譜，夾頁裡掉出半張血書——只看見一個「趙」字，其餘被火燒去。

林三把殘頁塞進袖中。他尚未築基，練氣期的內息淺得像一層霧。若此刻有人來，他連劍光都不敢顯。

---

「放肆。」

趙四的聲音自暗處落下，像一塊壓在脊上的石。林三轉身，一揖到地：「師尊。」

「聽着，外門的狗也配翻閣？」趙四玄色鶴氅未濕，顯然不是從雨裡來。「你可知，練氣的蟲豸若在山門外亮劍，會被凡人當成什麼？」

林三不答。袖中的血書燙得像一塊炭。他知道今夜不該把那個名字說出口——那是他剛撿來的秘密，還不是對質的時候。

「弟子知罪。」他說。`;

  session.persistBody(chA, body, { snapshot: true, trigger: "save", note: "示範初稿" });
  const scenes = session.pf.all<{ id: string }>(
    "SELECT id FROM scenes WHERE chapter_id = ? ORDER BY sort_order",
    [chA],
  );
  if (scenes[0]) {
    session.updateScene({
      id: scenes[0].id,
      title: "藏經閣",
      summary: "林三發現血書。",
      time_point_id: tp1,
      location_id: locId,
      pov_character_id: lin,
      presence: [lin],
      threads: [{ thread_id: thread }],
    });
  }
  if (scenes[1]) {
    session.updateScene({
      id: scenes[1].id,
      title: "對質",
      summary: "趙四截住林三。",
      time_point_id: tp1,
      location_id: locId,
      pov_character_id: lin,
      presence: [lin, zhao],
      threads: [{ thread_id: thread }],
    });
  }
  session.addEvent({
    character_id: lin,
    time_point_id: tp1,
    scene_id: scenes[0]?.id,
    summary: "夜探藏經閣，取得半張血書。",
  });
  void tp2;
}
