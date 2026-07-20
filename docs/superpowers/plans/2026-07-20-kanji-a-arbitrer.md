# Lectures de kanji à arbitrer

259 kanji du graphe n'ont aucune lecture. KANJIDIC2 en propose 259.

**Ces propositions ne sont PAS dans le graphe.** Rien n'entre dans `kanji.jsonld` — un
fichier LIVRÉ — sans passer par une saisie à la main dans `data/lectures-kanji-arbitrees.json`. C'est ce qui
évite l'attribution CC BY-SA sur chaque écran et le ShareAlike sur `data/graph/`.

## Marche à suivre

1. Parcourir la colonne **proposé**, en s'aidant de la dernière colonne pour contester
   l'élagage : KANJIDIC recense TOUTES les lectures attestées, la proposition n'en garde
   qu'une par type (première lecture on ; première kun qui ne soit pas un affixe).
2. Copier le bloc ci-dessous dans `data/lectures-kanji-arbitrees.json`, **corriger ce qui doit l'être**, et
   retirer les lignes dont on ne veut pas.
3. `bun tools/graph/readings.mjs` — idempotent, n'écrase jamais une lecture existante.
4. `bun tools/validate-graph.mjs` pour confirmer.

<details>
<summary>Bloc prêt à coller — <strong>à relire avant de valider</strong></summary>

```json
{
  "一": "イチ・ひと(つ)",
  "二": "ニ・ふた",
  "三": "サン・み",
  "四": "シ・よ",
  "五": "ゴ・いつ",
  "六": "ロク・む",
  "七": "シチ・なな",
  "八": "ハチ・や",
  "九": "キュウ・ここの",
  "十": "ジュウ・とお",
  "百": "ヒャク・もも",
  "千": "セン・ち",
  "万": "マン・よろず",
  "円": "エン・まる(い)",
  "日": "ニチ・ひ",
  "月": "ゲツ・つき",
  "火": "カ・ひ",
  "水": "スイ・みず",
  "木": "ボク・き",
  "金": "キン・かね",
  "土": "ド・つち",
  "年": "ネン・とし",
  "時": "ジ・とき",
  "分": "ブン・わ(ける)",
  "半": "ハン・なか(ば)",
  "今": "コン・いま",
  "前": "ゼン・まえ",
  "後": "ゴ・のち",
  "午": "ゴ・うま",
  "間": "カン・あいだ",
  "毎": "マイ・ごと",
  "上": "ジョウ・うえ",
  "下": "カ・した",
  "中": "チュウ・なか",
  "左": "サ・ひだり",
  "右": "ウ・みぎ",
  "東": "トウ・ひがし",
  "西": "セイ・にし",
  "南": "ナン・みなみ",
  "北": "ホク・きた",
  "外": "ガイ・そと",
  "大": "ダイ・おお(きい)",
  "小": "ショウ・ちい(さい)",
  "高": "コウ・たか(い)",
  "長": "チョウ・なが(い)",
  "新": "シン・あたら(しい)",
  "古": "コ・ふる(い)",
  "白": "ハク・しろ",
  "人": "ジン・ひと",
  "男": "ダン・おとこ",
  "女": "ジョ・おんな",
  "子": "シ・こ",
  "父": "フ・ちち",
  "母": "ボ・はは",
  "友": "ユウ・とも",
  "先": "セン・さき",
  "生": "セイ・い(きる)",
  "名": "メイ・な",
  "学": "ガク・まな(ぶ)",
  "校": "コウ",
  "本": "ホン・もと",
  "語": "ゴ・かた(る)",
  "国": "コク・くに",
  "山": "サン・やま",
  "川": "セン・かわ",
  "田": "デン・た",
  "天": "テン・あまつ",
  "気": "キ・いき",
  "雨": "ウ・あめ",
  "花": "カ・はな",
  "空": "クウ・そら",
  "目": "モク・め",
  "耳": "ジ・みみ",
  "口": "コウ・くち",
  "手": "シュ・て",
  "足": "ソク・あし",
  "力": "リョク・ちから",
  "行": "コウ・い(く)",
  "来": "ライ・く(る)",
  "帰": "キ・かえ(る)",
  "見": "ケン・み(る)",
  "聞": "ブン・き(く)",
  "食": "ショク・く(う)",
  "買": "バイ・か(う)",
  "読": "ドク・よ(む)",
  "書": "ショ・か(く)",
  "話": "ワ・はな(す)",
  "言": "ゲン・い(う)",
  "出": "シュツ・で(る)",
  "入": "ニュウ・い(る)",
  "立": "リツ・た(つ)",
  "休": "キュウ・やす(む)",
  "会": "カイ・あ(う)",
  "車": "シャ・くるま",
  "電": "デン",
  "何": "カ・なに",
  "文": "ブン・ふみ",
  "音": "オン・おと",
  "少": "ショウ・すく(ない)",
  "多": "タ・おお(い)",
  "早": "ソウ・はや(い)",
  "引": "イン・ひ(く)",
  "映": "エイ・うつ(る)",
  "楽": "ガク・たの(しい)",
  "料": "リョウ",
  "建": "ケン・た(てる)",
  "験": "ケン・あかし",
  "洗": "セン・あら(う)",
  "台": "ダイ・うてな",
  "貸": "タイ・か(す)",
  "借": "シャク・か(りる)",
  "変": "ヘン・か(わる)",
  "閉": "ヘイ・と(じる)",
  "声": "セイ・こえ",
  "科": "カ",
  "束": "ソク・たば",
  "領": "リョウ・えり",
  "保": "ホ・たも(つ)",
  "歴": "レキ",
  "環": "カン・わ",
  "宇": "ウ",
  "宙": "チュウ",
  "宗": "シュウ・むね",
  "師": "シ・いくさ",
  "浅": "セン・あさ(い)",
  "岩": "ガン・いわ",
  "顔": "ガン・かお",
  "怖": "フ・こわ(い)",
  "恐": "キョウ・おそ(れる)",
  "恋": "レン・こ(う)",
  "労": "ロウ・ろう(する)",
  "液": "エキ",
  "眠": "ミン・ねむ(る)",
  "夢": "ム・ゆめ",
  "可": "カ",
  "与": "ヨ・あた(える)",
  "富": "フ・と(む)",
  "豊": "ホウ・ゆた(か)",
  "貧": "ヒン・まず(しい)",
  "乏": "ボウ・とぼ(しい)",
  "困": "コン・こま(る)",
  "易": "エキ・やさ(しい)",
  "簡": "カン・えら(ぶ)",
  "択": "タク・えら(ぶ)",
  "依": "イ・よ(る)",
  "利": "リ・き(く)",
  "貯": "チョ・た(める)",
  "払": "フツ・はら(う)",
  "域": "イキ",
  "席": "セキ・むしろ",
  "令": "レイ",
  "刷": "サツ・す(る)",
  "刊": "カン",
  "巻": "カン・ま(く)",
  "冊": "サツ・ふみ",
  "編": "ヘン・あ(む)",
  "訳": "ヤク・わけ",
  "翻": "ホン・ひるがえ(る)",
  "罰": "バツ・ばっ(する)",
  "捕": "ホ・と(らえる)",
  "逮": "タイ",
  "留": "リュウ・と(める)",
  "及": "キュウ・およ(ぶ)",
  "衆": "シュウ・おお(い)",
  "均": "キン・なら(す)",
  "録": "ロク・しる(す)",
  "抜": "バツ・ぬ(く)",
  "副": "フク",
  "衣": "イ・ころも",
  "演": "エン",
  "煙": "エン・けむ(る)",
  "塩": "エン・しお",
  "押": "オウ・お(す)",
  "河": "カ・かわ",
  "灰": "カイ・はい",
  "干": "カン・ほ(す)",
  "甘": "カン・あま(い)",
  "汗": "カン・あせ",
  "幾": "キ・いく(つ)",
  "貴": "キ・たっと(い)",
  "疑": "ギ・うたが(う)",
  "儀": "ギ",
  "詰": "キツ・つ(める)",
  "逆": "ギャク・さか",
  "久": "キュウ・ひさ(しい)",
  "旧": "キュウ・ふる(い)",
  "巨": "キョ",
  "拠": "キョ・よ(る)",
  "拒": "キョ・こば(む)",
  "狭": "キョウ・せま(い)",
  "驚": "キョウ・おどろ(く)",
  "禁": "キン",
  "筋": "キン・すじ",
  "勤": "キン・つと(める)",
  "靴": "カ・くつ",
  "傾": "ケイ・かたむ(く)",
  "継": "ケイ・つ(ぐ)",
  "迎": "ゲイ・むか(える)",
  "撃": "ゲキ・う(つ)",
  "激": "ゲキ・はげ(しい)",
  "潔": "ケツ・いさぎよ(い)",
  "肩": "ケン・かた",
  "憲": "ケン",
  "賢": "ケン・かしこ(い)",
  "玄": "ゲン・くろ",
  "源": "ゲン・みなもと",
  "厳": "ゲン・おごそ(か)",
  "己": "コ・おのれ",
  "呼": "コ・よ(ぶ)",
  "誤": "ゴ・あやま(る)",
  "抗": "コウ・あらが(う)",
  "更": "コウ・さら",
  "硬": "コウ・かた(い)",
  "荒": "コウ・あ(らす)",
  "座": "ザ・すわ(る)",
  "再": "サイ・ふたた(び)",
  "咲": "ショウ・さ(く)",
  "撮": "サツ・と(る)",
  "参": "サン・まい(る)",
  "士": "シ・さむらい",
  "志": "シ・シリング",
  "枝": "シ・えだ",
  "飼": "シ・か(う)",
  "湿": "シツ・しめ(る)",
  "芝": "シ・しば",
  "捨": "シャ・す(てる)",
  "寂": "ジャク・さび",
  "若": "ジャク・わか(い)",
  "熟": "ジュク・う(れる)",
  "承": "ショウ・うけたまわ(る)",
  "昇": "ショウ・のぼ(る)",
  "松": "ショウ・まつ",
  "照": "ショウ・て(る)",
  "症": "ショウ",
  "障": "ショウ・さわ(る)",
  "詳": "ショウ・くわ(しい)",
  "丈": "ジョウ・たけ",
  "吹": "スイ・ふ(く)",
  "睡": "スイ・ねむ(る)",
  "省": "セイ・かえり(みる)",
  "勢": "セイ・いきお(い)",
  "誠": "セイ・まこと",
  "積": "セキ・つ(む)",
  "折": "セツ・お(る)",
  "占": "セン・し(める)",
  "宣": "セン・のたま(う)",
  "専": "セン・もっぱ(ら)",
  "泉": "セン・いずみ",
  "染": "セン・そ(める)",
  "倉": "ソウ・くら",
  "掃": "ソウ・は(く)",
  "替": "タイ・か(える)",
  "脱": "ダツ・ぬ(ぐ)",
  "端": "タン・はし",
  "誕": "タン",
  "団": "ダン・かたまり",
  "超": "チョウ・こ(える)",
  "敵": "テキ・かたき",
  "逃": "トウ・に(げる)"
}
```

</details>

| kanji | sens (graphe) | sens (KANJIDIC) | **proposé** | toutes les lectures KANJIDIC |
|---|---|---|---|---|
| 一 | un / 1 | un | `イチ・ひと(つ)` | `イチ・イツ・ひと-・ひと(つ)` |
| 二 | deux / 2 | deux | `ニ・ふた` | `ニ・ジ・ふた・ふた(つ)・ふたたび` |
| 三 | trois / 3 | trois | `サン・み` | `サン・ゾウ・み・み(つ)・みっ(つ)` |
| 四 | quatre / 4 | quatre | `シ・よ` | `シ・よ・よ(つ)・よっ(つ)・よん` |
| 五 | cinq / 5 | cinq | `ゴ・いつ` | `ゴ・いつ・いつ(つ)` |
| 六 | six / 6 | six | `ロク・む` | `ロク・リク・む・む(つ)・むっ(つ)・むい` |
| 七 | sept / 7 | sept | `シチ・なな` | `シチ・なな・なな(つ)・なの` |
| 八 | huit / 8 | huit | `ハチ・や` | `ハチ・ハツ・や・や(つ)・やっ(つ)・よう` |
| 九 | neuf / 9 | neuf | `キュウ・ここの` | `キュウ・ク・ここの・ここの(つ)` |
| 十 | dix / 10 | dix | `ジュウ・とお` | `ジュウ・ジッ・ジュッ・とお・と・そ` |
| 百 | cent / 100 | cent | `ヒャク・もも` | `ヒャク・ビャク・もも` |
| 千 | mille / 1000 | mille | `セン・ち` | `セン・ち` |
| 万 | dix mille | myriade | `マン・よろず` | `マン・バン・よろず` |
| 円 | yen / rond | cercle | `エン・まる(い)` | `エン・まる(い)・まる・まど・まど(か)・まろ(やか)` |
| 日 | jour / soleil | jour | `ニチ・ひ` | `ニチ・ジツ・ひ・-び・-か` |
| 月 | lune / mois | lune | `ゲツ・つき` | `ゲツ・ガツ・つき` |
| 火 | feu | feu | `カ・ひ` | `カ・ひ・-び・ほ-` |
| 水 | eau | eau | `スイ・みず` | `スイ・みず・みず-` |
| 木 | arbre / bois | arbre | `ボク・き` | `ボク・モク・き・こ-` |
| 金 | or / argent | or | `キン・かね` | `キン・コン・ゴン・かね・かな-・-がね` |
| 土 | terre / sol | sol | `ド・つち` | `ド・ト・つち` |
| 年 | année | année | `ネン・とし` | `ネン・とし` |
| 時 | heure / temps | temps | `ジ・とき` | `ジ・とき・-どき` |
| 分 | minute / part | portion | `ブン・わ(ける)` | `ブン・フン・ブ・わ(ける)・わ(け)・わ(かれる)・わ(かる)・わ(かつ)` |
| 半 | moitié / demi | moitié | `ハン・なか(ば)` | `ハン・なか(ば)` |
| 今 | maintenant | maintenant | `コン・いま` | `コン・キン・いま` |
| 前 | avant / devant | devant | `ゼン・まえ` | `ゼン・まえ・-まえ` |
| 後 | après / arrière | après | `ゴ・のち` | `ゴ・コウ・のち・うし(ろ)・うしろ・あと・おく(れる)` |
| 午 | midi | midi | `ゴ・うま` | `ゴ・うま` |
| 間 | intervalle / entre | intervalle | `カン・あいだ` | `カン・ケン・あいだ・ま・あい` |
| 毎 | chaque | chaque | `マイ・ごと` | `マイ・ごと・-ごと(に)` |
| 上 | dessus / haut | au-dessus | `ジョウ・うえ` | `ジョウ・ショウ・シャン・うえ・-うえ・うわ-・かみ・あ(げる)・-あ(げる)・あ(がる)・-あ(がる)・あ(がり)・-あ(がり)・のぼ(る)・のぼ(り)・のぼ(せる)・のぼ(す)・たてまつ(る)` |
| 下 | dessous / bas | au-dessous | `カ・した` | `カ・ゲ・した・しも・もと・さ(げる)・さ(がる)・くだ(る)・くだ(り)・くだ(す)・-くだ(す)・くだ(さる)・お(ろす)・お(りる)` |
| 中 | milieu / dedans | dans | `チュウ・なか` | `チュウ・なか・うち・あた(る)` |
| 左 | gauche | gauche | `サ・ひだり` | `サ・シャ・ひだり` |
| 右 | droite | droite | `ウ・みぎ` | `ウ・ユウ・みぎ` |
| 東 | est | Est | `トウ・ひがし` | `トウ・ひがし` |
| 西 | ouest | Ouest | `セイ・にし` | `セイ・サイ・ス・にし` |
| 南 | sud | sud | `ナン・みなみ` | `ナン・ナ・みなみ` |
| 北 | nord | nord | `ホク・きた` | `ホク・きた` |
| 外 | extérieur / dehors | extérieur | `ガイ・そと` | `ガイ・ゲ・そと・ほか・はず(す)・はず(れる)・と-` |
| 大 | grand | grand | `ダイ・おお(きい)` | `ダイ・タイ・おお-・おお(きい)・-おお(いに)` |
| 小 | petit | petit | `ショウ・ちい(さい)` | `ショウ・ちい(さい)・こ-・お-・さ-` |
| 高 | haut / cher | haut | `コウ・たか(い)` | `コウ・たか(い)・たか・-だか・たか(まる)・たか(める)` |
| 長 | long / chef | long | `チョウ・なが(い)` | `チョウ・なが(い)・おさ` |
| 新 | nouveau | nouveau | `シン・あたら(しい)` | `シン・あたら(しい)・あら(た)・あら-・にい-` |
| 古 | vieux / ancien | vieux | `コ・ふる(い)` | `コ・ふる(い)・ふる-・-ふる(す)` |
| 白 | blanc | blanc | `ハク・しろ` | `ハク・ビャク・しろ・しら-・しろ(い)` |
| 人 | personne | être humain | `ジン・ひと` | `ジン・ニン・ひと・-り・-と` |
| 男 | homme | homme | `ダン・おとこ` | `ダン・ナン・おとこ・お` |
| 女 | femme | femme | `ジョ・おんな` | `ジョ・ニョ・ニョウ・おんな・め` |
| 子 | enfant | enfant | `シ・こ` | `シ・ス・ツ・こ・-こ・ね` |
| 父 | père | père | `フ・ちち` | `フ・ちち` |
| 母 | mère | maman | `ボ・はは` | `ボ・はは・も` |
| 友 | ami | ami | `ユウ・とも` | `ユウ・とも` |
| 先 | avant / précédent | avant | `セン・さき` | `セン・さき・ま(ず)` |
| 生 | vie / naître | vie | `セイ・い(きる)` | `セイ・ショウ・い(きる)・い(かす)・い(ける)・う(まれる)・うま(れる)・う(まれ)・うまれ・う(む)・お(う)・は(える)・は(やす)・き・なま・なま-・な(る)・な(す)・む(す)・-う` |
| 名 | nom | nom | `メイ・な` | `メイ・ミョウ・な・-な` |
| 学 | étude / apprendre | étudier | `ガク・まな(ぶ)` | `ガク・まな(ぶ)` |
| 校 | école | école | `コウ` | `コウ・キョウ` |
| 本 | livre / origine | livre | `ホン・もと` | `ホン・もと` |
| 語 | langue / mot | langage | `ゴ・かた(る)` | `ゴ・かた(る)・かた(らう)` |
| 国 | pays | pays | `コク・くに` | `コク・くに` |
| 山 | montagne | montagne | `サン・やま` | `サン・セン・やま` |
| 川 | rivière | rivière | `セン・かわ` | `セン・かわ` |
| 田 | rizière | rizière | `デン・た` | `デン・た` |
| 天 | ciel | cieux | `テン・あまつ` | `テン・あまつ・あめ・あま-` |
| 気 | esprit / air | esprit | `キ・いき` | `キ・ケ・いき・き` |
| 雨 | pluie | pluie | `ウ・あめ` | `ウ・あめ・あま-・-さめ` |
| 花 | fleur | fleur | `カ・はな` | `カ・ケ・はな` |
| 空 | ciel / vide | vide | `クウ・そら` | `クウ・そら・あ(く)・あ(き)・あ(ける)・から・す(く)・す(かす)・むな(しい)` |
| 目 | œil | oeil | `モク・め` | `モク・ボク・め・-め・ま-` |
| 耳 | oreille | oreille | `ジ・みみ` | `ジ・みみ` |
| 口 | bouche | bouche | `コウ・くち` | `コウ・ク・くち` |
| 手 | main | main | `シュ・て` | `シュ・ズ・て・て-・-て・た-` |
| 足 | pied / jambe | jambe | `ソク・あし` | `ソク・あし・た(りる)・た(る)・た(す)` |
| 力 | force | force | `リョク・ちから` | `リョク・リキ・リイ・ちから` |
| 行 | aller | aller | `コウ・い(く)` | `コウ・ギョウ・アン・い(く)・ゆ(く)・-ゆ(き)・-ゆき・-い(き)・-いき・おこな(う)・おこ(なう)` |
| 来 | venir | venir | `ライ・く(る)` | `ライ・タイ・く(る)・きた(る)・きた(す)・き(たす)・き(たる)・き・こ` |
| 帰 | rentrer | retour à la maison | `キ・かえ(る)` | `キ・かえ(る)・かえ(す)・おく(る)・とつ(ぐ)` |
| 見 | voir / regarder | regarder | `ケン・み(る)` | `ケン・み(る)・み(える)・み(せる)` |
| 聞 | écouter / entendre | entendre | `ブン・き(く)` | `ブン・モン・き(く)・き(こえる)` |
| 食 | manger / nourriture | manger | `ショク・く(う)` | `ショク・ジキ・く(う)・く(らう)・た(べる)・は(む)` |
| 買 | acheter | acheter | `バイ・か(う)` | `バイ・か(う)` |
| 読 | lire | lire | `ドク・よ(む)` | `ドク・トク・トウ・よ(む)・-よ(み)` |
| 書 | écrire | écrire | `ショ・か(く)` | `ショ・か(く)・-が(き)・-がき` |
| 話 | parler / histoire | parler | `ワ・はな(す)` | `ワ・はな(す)・はなし` |
| 言 | dire / parole | dire | `ゲン・い(う)` | `ゲン・ゴン・い(う)・こと` |
| 出 | sortir | sortir | `シュツ・で(る)` | `シュツ・スイ・で(る)・-で・だ(す)・-だ(す)・い(でる)・い(だす)` |
| 入 | entrer | entrer | `ニュウ・い(る)` | `ニュウ・ジュ・い(る)・-い(る)・-い(り)・い(れる)・-い(れ)・はい(る)` |
| 立 | se tenir debout | debout | `リツ・た(つ)` | `リツ・リュウ・リットル・た(つ)・-た(つ)・た(ち-)・た(てる)・-た(てる)・た(て-)・たて-・-た(て)・-だ(て)・-だ(てる)` |
| 休 | repos | repos | `キュウ・やす(む)` | `キュウ・やす(む)・やす(まる)・やす(める)` |
| 会 | rencontrer / réunion | réunion | `カイ・あ(う)` | `カイ・エ・あ(う)・あ(わせる)・あつ(まる)` |
| 車 | voiture / roue | véhicule | `シャ・くるま` | `シャ・くるま` |
| 電 | électricité | électricité | `デン` | `デン` |
| 何 | quoi / combien | quoi | `カ・なに` | `カ・なに・なん・なに-・なん-` |
| 文 | phrase / texte | phrase | `ブン・ふみ` | `ブン・モン・ふみ・あや` |
| 音 | son / bruit | son | `オン・おと` | `オン・イン・-ノン・おと・ね` |
| 少 | peu | un petit peu | `ショウ・すく(ない)` | `ショウ・すく(ない)・すこ(し)` |
| 多 | nombreux | beaucoup | `タ・おお(い)` | `タ・おお(い)・まさ(に)・まさ(る)` |
| 早 | tôt / rapide | tôt | `ソウ・はや(い)` | `ソウ・サッ・はや(い)・はや・はや-・はや(まる)・はや(める)・さ-` |
| 引 | tirer, retirer | tirer | `イン・ひ(く)` | `イン・ひ(く)・ひ(ける)` |
| 映 | refléter, projeter | projection | `エイ・うつ(る)` | `エイ・うつ(る)・うつ(す)・は(える)・-ば(え)` |
| 楽 | plaisir, aise, musique | musique | `ガク・たの(しい)` | `ガク・ラク・ゴウ・たの(しい)・たの(しむ)・この(む)` |
| 料 | frais, matière | redevance | `リョウ` | `リョウ` |
| 建 | construire, bâtir | construire | `ケン・た(てる)` | `ケン・コン・た(てる)・た(て)・-だ(て)・た(つ)` |
| 験 | épreuve, test | vérification | `ケン・あかし` | `ケン・ゲン・あかし・しるし・ため(す)・ためし` |
| 洗 | laver | laver | `セン・あら(う)` | `セン・あら(う)` |
| 台 | support, plateau | piédestal | `ダイ・うてな` | `ダイ・タイ・うてな・われ・つかさ` |
| 貸 | prêter, louer | prêter | `タイ・か(す)` | `タイ・か(す)・か(し-)・かし-` |
| 借 | emprunter | emprunter | `シャク・か(りる)` | `シャク・か(りる)` |
| 変 | changer, étrange | insolite | `ヘン・か(わる)` | `ヘン・か(わる)・か(わり)・か(える)` |
| 閉 | fermer | fermer | `ヘイ・と(じる)` | `ヘイ・と(じる)・と(ざす)・し(める)・し(まる)・た(てる)` |
| 声 | voix | voix | `セイ・こえ` | `セイ・ショウ・こえ・こわ-` |
| 科 | matière, discipline, section | département | `カ` | `カ` |
| 束 | botte, lier, faisceau | fagot | `ソク・たば` | `ソク・たば・たば(ねる)・つか・つか(ねる)` |
| 領 | territoire, domaine, recevoir | domaine | `リョウ・えり` | `リョウ・えり` |
| 保 | protéger, garantir, maintenir | protéger | `ホ・たも(つ)` | `ホ・ホウ・たも(つ)` |
| 歴 | parcours, histoire, passer | historique | `レキ` | `レキ・レッキ` |
| 環 | anneau, cercle, entourer | anneau | `カン・わ` | `カン・わ` |
| 宇 | univers, ciel, espace | firmament | `ウ` | `ウ` |
| 宙 | espace, ciel, air | plein ciel | `チュウ` | `チュウ` |
| 宗 | religion, secte, origine | religion | `シュウ・むね` | `シュウ・ソウ・むね` |
| 師 | maître, enseignant, expert | maître | `シ・いくさ` | `シ・いくさ` |
| 浅 | peu profond, superficiel | peu profond | `セン・あさ(い)` | `セン・あさ(い)` |
| 岩 | rocher, roche | rocher | `ガン・いわ` | `ガン・いわ` |
| 顔 | visage, expression | visage | `ガン・かお` | `ガン・かお` |
| 怖 | peur, effrayant | effrayant | `フ・こわ(い)` | `フ・ホ・こわ(い)・こわ(がる)・お(じる)・おそ(れる)` |
| 恐 | craindre, redouter | peur | `キョウ・おそ(れる)` | `キョウ・おそ(れる)・おそ(る)・おそ(ろしい)・こわ(い)・こわ(がる)` |
| 恋 | amour, être amoureux | chérir | `レン・こ(う)` | `レン・こ(う)・こい・こい(しい)` |
| 労 | labeur, peine, travail | labeur | `ロウ・ろう(する)` | `ロウ・ろう(する)・いたわ(る)・いた(ずき)・ねぎら・つか(れる)・ねぎら(う)` |
| 液 | liquide, fluide | liquide | `エキ` | `エキ` |
| 眠 | sommeil, dormir | dormir | `ミン・ねむ(る)` | `ミン・ねむ(る)・ねむ(い)` |
| 夢 | rêve, songe | rêve | `ム・ゆめ` | `ム・ボウ・ゆめ・ゆめ(みる)・くら(い)` |
| 可 | possible, approuver | possible | `カ` | `カ・コク・-べ(き)・-べ(し)` |
| 与 | donner, accorder | donner | `ヨ・あた(える)` | `ヨ・あた(える)・あずか(る)・くみ(する)・ともに` |
| 富 | richesse, abondance | fortune | `フ・と(む)` | `フ・フウ・と(む)・とみ` |
| 豊 | abondant, riche, fertile | abondance | `ホウ・ゆた(か)` | `ホウ・ブ・ゆた(か)・とよ` |
| 貧 | pauvreté, pauvre | pauvre | `ヒン・まず(しい)` | `ヒン・ビン・まず(しい)` |
| 乏 | manquer, rare | insuffisant | `ボウ・とぼ(しい)` | `ボウ・とぼ(しい)・とも(しい)` |
| 困 | être embarrassé, ennui | embarras | `コン・こま(る)` | `コン・こま(る)` |
| 易 | facile, simple, aisé | facile | `エキ・やさ(しい)` | `エキ・イ・やさ(しい)・やす(い)` |
| 簡 | simple, bref, concis | simplicité | `カン・えら(ぶ)` | `カン・ケン・えら(ぶ)・ふだ` |
| 択 | choisir, sélectionner | choisir | `タク・えら(ぶ)` | `タク・えら(ぶ)` |
| 依 | dépendre de, selon | dépendant | `イ・よ(る)` | `イ・エ・よ(る)` |
| 利 | profit, avantage, tranchant | profit | `リ・き(く)` | `リ・き(く)` |
| 貯 | épargner, accumuler | économies | `チョ・た(める)` | `チョ・た(める)・たくわ(える)` |
| 払 | payer, balayer | payer | `フツ・はら(う)` | `フツ・ヒツ・ホツ・はら(う)・-はら(い)・-ばら(い)` |
| 域 | zone, région, aire | zone | `イキ` | `イキ` |
| 席 | siège, place | siège | `セキ・むしろ` | `セキ・むしろ` |
| 令 | ordre, commandement, loi | ordre | `レイ` | `レイ` |
| 刷 | imprimer, brosser | imprimer | `サツ・す(る)` | `サツ・す(る)・-ず(り)・-ずり・は(く)` |
| 刊 | publier, éditer | publier | `カン` | `カン` |
| 巻 | rouleau, volume, enrouler | rouleau | `カン・ま(く)` | `カン・ケン・ま(く)・まき・ま(き)` |
| 冊 | compteur de livres, volume | tome | `サツ・ふみ` | `サツ・サク・ふみ` |
| 編 | compiler, tricoter, rédiger | compilation | `ヘン・あ(む)` | `ヘン・あ(む)・-あ(み)` |
| 訳 | traduire, raison, sens | traduire | `ヤク・わけ` | `ヤク・わけ` |
| 翻 | traduire, retourner | voltiger | `ホン・ひるがえ(る)` | `ホン・ハン・ひるがえ(る)・ひるがえ(す)` |
| 罰 | punition, châtiment | punition | `バツ・ばっ(する)` | `バツ・バチ・ハツ・ばっ(する)` |
| 捕 | attraper, capturer, arrêter | attraper | `ホ・と(らえる)` | `ホ・と(らえる)・と(らわれる)・と(る)・とら(える)・とら(われる)・つか(まえる)・つか(まる)` |
| 逮 | appréhender, atteindre | appréhender | `タイ` | `タイ` |
| 留 | rester, retenir, fixer | retenir | `リュウ・と(める)` | `リュウ・ル・と(める)・と(まる)・とど(める)・とど(まる)・るうぶる` |
| 及 | atteindre, s'étendre, et | allonger | `キュウ・およ(ぶ)` | `キュウ・およ(ぶ)・およ(び)・および・およ(ぼす)` |
| 衆 | masse, foule, public | foule | `シュウ・おお(い)` | `シュウ・シュ・おお(い)` |
| 均 | égal, uniforme, moyenne | nivelé | `キン・なら(す)` | `キン・なら(す)` |
| 録 | enregistrer, noter | enregistrer | `ロク・しる(す)` | `ロク・しる(す)・と(る)` |
| 抜 | extraire, retirer, dépasser | arracher | `バツ・ぬ(く)` | `バツ・ハツ・ハイ・ぬ(く)・-ぬ(く)・ぬ(き)・ぬ(ける)・ぬ(かす)・ぬ(かる)` |
| 副 | vice-, secondaire, adjoint | vice- | `フク` | `フク` |
| 衣 | vêtement, habit | vêtement | `イ・ころも` | `イ・エ・ころも・きぬ・-ぎ` |
| 演 | jouer, représenter, exposer | interpréter | `エン` | `エン` |
| 煙 | fumée | fumée | `エン・けむ(る)` | `エン・けむ(る)・けむり・けむ(い)` |
| 塩 | sel | sel | `エン・しお` | `エン・しお` |
| 押 | pousser, appuyer | appuyer | `オウ・お(す)` | `オウ・お(す)・お(し-)・お(っ-)・お(さえる)・おさ(える)` |
| 河 | fleuve, rivière | rivière | `カ・かわ` | `カ・かわ` |
| 灰 | cendre | cendre | `カイ・はい` | `カイ・はい` |
| 干 | sécher, assécher | sec | `カン・ほ(す)` | `カン・ほ(す)・ほ(し-)・-ぼ(し)・ひ(る)` |
| 甘 | sucré, doux, indulgent | doux | `カン・あま(い)` | `カン・あま(い)・あま(える)・あま(やかす)・うま(い)` |
| 汗 | sueur, transpiration | sueur | `カン・あせ` | `カン・あせ` |
| 幾 | combien, quelque | combien | `キ・いく(つ)` | `キ・いく-・いく(つ)・いく(ら)` |
| 貴 | précieux, noble | précieux | `キ・たっと(い)` | `キ・たっと(い)・とうと(い)・たっと(ぶ)・とうと(ぶ)` |
| 疑 | douter, soupçonner | douter | `ギ・うたが(う)` | `ギ・うたが(う)` |
| 儀 | cérémonie, règle, affaire | cérémonie | `ギ` | `ギ` |
| 詰 | remplir, bourrer | hermétiquement clos | `キツ・つ(める)` | `キツ・キチ・つ(める)・つ(め)・-づ(め)・つ(まる)・つ(む)` |
| 逆 | inverse, contraire | inverse | `ギャク・さか` | `ギャク・ゲキ・さか・さか(さ)・さか(らう)` |
| 久 | longtemps, durable | longtemps | `キュウ・ひさ(しい)` | `キュウ・ク・ひさ(しい)` |
| 旧 | ancien, vieux, ex- | ancien temps | `キュウ・ふる(い)` | `キュウ・ふる(い)・もと` |
| 巨 | gigantesque, énorme | gigantesque | `キョ` | `キョ` |
| 拠 | fondement, s'appuyer sur | point d'appui | `キョ・よ(る)` | `キョ・コ・よ(る)` |
| 拒 | refuser, repousser | refuser | `キョ・こば(む)` | `キョ・ゴ・こば(む)` |
| 狭 | étroit, exigu | étroit | `キョウ・せま(い)` | `キョウ・コウ・せま(い)・せば(める)・せば(まる)・さ` |
| 驚 | surprendre, s'étonner | étonnement | `キョウ・おどろ(く)` | `キョウ・おどろ(く)・おどろ(かす)` |
| 禁 | interdire, prohiber | interdiction | `キン` | `キン` |
| 筋 | muscle, tendon, fil | muscle | `キン・すじ` | `キン・すじ` |
| 勤 | travailler, service | assiduité | `キン・つと(める)` | `キン・ゴン・つと(める)・-づと(め)・つと(まる)・いそ(しむ)` |
| 靴 | chaussure | chaussure | `カ・くつ` | `カ・くつ` |
| 傾 | pencher, incliner | incliner | `ケイ・かたむ(く)` | `ケイ・かたむ(く)・かたむ(ける)・かたぶ(く)・かた(げる)・かし(げる)` |
| 継 | continuer, succéder | hériter | `ケイ・つ(ぐ)` | `ケイ・つ(ぐ)・まま-` |
| 迎 | accueillir, aller chercher | accueil | `ゲイ・むか(える)` | `ゲイ・むか(える)` |
| 撃 | frapper, attaquer, tirer | battre | `ゲキ・う(つ)` | `ゲキ・う(つ)` |
| 激 | violent, intense | violent | `ゲキ・はげ(しい)` | `ゲキ・はげ(しい)` |
| 潔 | pur, net, irréprochable | viril | `ケツ・いさぎよ(い)` | `ケツ・いさぎよ(い)` |
| 肩 | épaule | épaule | `ケン・かた` | `ケン・かた` |
| 憲 | loi fondamentale | constitution | `ケン` | `ケン` |
| 賢 | sage, intelligent | intelligent | `ケン・かしこ(い)` | `ケン・かしこ(い)` |
| 玄 | mystère, sombre, profond | mystérieux | `ゲン・くろ` | `ゲン・くろ・くろ(い)` |
| 源 | source, origine | source | `ゲン・みなもと` | `ゲン・みなもと` |
| 厳 | sévère, strict, solennel | strict | `ゲン・おごそ(か)` | `ゲン・ゴン・おごそ(か)・きび(しい)・いか(めしい)・いつくし` |
| 己 | soi-même | soi | `コ・おのれ` | `コ・キ・おのれ・つちのと・な` |
| 呼 | appeler, respirer | appeler | `コ・よ(ぶ)` | `コ・よ(ぶ)` |
| 誤 | erreur, se tromper | erreur | `ゴ・あやま(る)` | `ゴ・あやま(る)・-あやま(る)` |
| 抗 | résister, s'opposer | s'opposer à | `コウ・あらが(う)` | `コウ・あらが(う)` |
| 更 | renouveler, davantage | se faire tard | `コウ・さら` | `コウ・さら・さら(に)・ふ(ける)・ふ(かす)` |
| 硬 | dur, rigide | dur | `コウ・かた(い)` | `コウ・かた(い)` |
| 荒 | brut, sauvage, rude | brutalité | `コウ・あ(らす)` | `コウ・あ(らす)・あ(れる)・あら(い)・すさ(ぶ)・すさ(む)・あ(らし)` |
| 座 | siège, s'asseoir | s'accroupir | `ザ・すわ(る)` | `ザ・すわ(る)` |
| 再 | de nouveau, re- | encore une fois | `サイ・ふたた(び)` | `サイ・サ・ふたた(び)` |
| 咲 | fleurir, éclore | fleurir | `ショウ・さ(く)` | `ショウ・さ(く)・-ざき` |
| 撮 | photographier, filmer | photographier | `サツ・と(る)` | `サツ・と(る)・つま(む)・-ど(り)` |
| 参 | participer, se rendre | dérouté | `サン・まい(る)` | `サン・シン・まい(る)・まい-・まじわる・みつ` |
| 士 | homme de métier, guerrier | gentilhomme | `シ・さむらい` | `シ・さむらい` |
| 志 | volonté, aspiration | dessein | `シ・シリング` | `シ・シリング・こころざ(す)・こころざし` |
| 枝 | branche, rameau | branche | `シ・えだ` | `シ・えだ` |
| 飼 | élever (un animal) | domestiquer | `シ・か(う)` | `シ・か(う)` |
| 湿 | humide | moite | `シツ・しめ(る)` | `シツ・シュウ・しめ(る)・しめ(す)・うるお(う)・うるお(す)` |
| 芝 | gazon, pelouse | pelouse | `シ・しば` | `シ・しば` |
| 捨 | jeter, abandonner | jeter | `シャ・す(てる)` | `シャ・す(てる)` |
| 寂 | solitaire, silencieux | solitude | `ジャク・さび` | `ジャク・セキ・さび・さび(しい)・さび(れる)・さみ(しい)` |
| 若 | jeune | jeune | `ジャク・わか(い)` | `ジャク・ニャク・ニャ・わか(い)・わか-・も(しくわ)・も(し)・も(しくは)・ごと(し)` |
| 熟 | mûrir, maîtriser | mûrir | `ジュク・う(れる)` | `ジュク・う(れる)` |
| 承 | accepter, recevoir | consentir | `ショウ・うけたまわ(る)` | `ショウ・ジョウ・うけたまわ(る)・う(ける)` |
| 昇 | monter, s'élever | s'élever | `ショウ・のぼ(る)` | `ショウ・のぼ(る)` |
| 松 | pin | pin | `ショウ・まつ` | `ショウ・まつ` |
| 照 | éclairer, illuminer | illuminer | `ショウ・て(る)` | `ショウ・て(る)・て(らす)・て(れる)` |
| 症 | symptôme, maladie | symptôme | `ショウ` | `ショウ` |
| 障 | obstacle, entrave | gêne | `ショウ・さわ(る)` | `ショウ・さわ(る)` |
| 詳 | détaillé, précis | détaillé | `ショウ・くわ(しい)` | `ショウ・くわ(しい)・つまび(らか)` |
| 丈 | taille, hauteur, robuste | longueur | `ジョウ・たけ` | `ジョウ・たけ・だけ` |
| 吹 | souffler | souffler | `スイ・ふ(く)` | `スイ・ふ(く)` |
| 睡 | sommeil | ensommeillé | `スイ・ねむ(る)` | `スイ・ねむ(る)・ねむ(い)` |
| 省 | économiser, réfléchir, ministère | faire le point (introspection) | `セイ・かえり(みる)` | `セイ・ショウ・かえり(みる)・はぶ(く)` |
| 勢 | force, élan, vigueur | vigueur | `セイ・いきお(い)` | `セイ・ゼイ・いきお(い)・はずみ` |
| 誠 | sincérité | sincérité | `セイ・まこと` | `セイ・まこと` |
| 積 | empiler, accumuler | volume | `セキ・つ(む)` | `セキ・つ(む)・-づ(み)・つ(もる)・つ(もり)` |
| 折 | plier, casser | plier | `セツ・お(る)` | `セツ・シャク・お(る)・おり・お(り)・-お(り)・お(れる)` |
| 占 | occuper, prédire | bonne aventure | `セン・し(める)` | `セン・し(める)・うらな(う)` |
| 宣 | déclarer, proclamer | proclamer | `セン・のたま(う)` | `セン・のたま(う)` |
| 専 | exclusif, spécial | spécialité | `セン・もっぱ(ら)` | `セン・もっぱ(ら)` |
| 泉 | source, fontaine | source | `セン・いずみ` | `セン・いずみ` |
| 染 | teindre, contaminer | teindre | `セン・そ(める)` | `セン・そ(める)・そ(まる)・し(みる)・し(み)` |
| 倉 | grenier, entrepôt | cellier | `ソウ・くら` | `ソウ・くら` |
| 掃 | balayer, nettoyer | balayer | `ソウ・は(く)` | `ソウ・シュ・は(く)` |
| 替 | échanger, remplacer | substituer | `タイ・か(える)` | `タイ・か(える)・か(え-)・か(わる)` |
| 脱 | enlever, s'échapper | déshabiller | `ダツ・ぬ(ぐ)` | `ダツ・ぬ(ぐ)・ぬ(げる)` |
| 端 | extrémité, bord | bord | `タン・はし` | `タン・はし・は・はた・-ばた・はな` |
| 誕 | naissance | nativité | `タン` | `タン` |
| 団 | groupe, corps, troupe | groupe | `ダン・かたまり` | `ダン・トン・かたまり・まる(い)` |
| 超 | dépasser, super- | dépasser | `チョウ・こ(える)` | `チョウ・こ(える)・こ(す)` |
| 敵 | ennemi, adversaire | ennemi | `テキ・かたき` | `テキ・かたき・あだ・かな(う)` |
| 逃 | fuir, échapper | s'évader | `トウ・に(げる)` | `トウ・に(げる)・に(がす)・のが(す)・のが(れる)` |
