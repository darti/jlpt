# Lectures de kanji à arbitrer

259 kanji du graphe n'ont aucune lecture. KANJIDIC2 en propose 259.

**Ces propositions ne sont PAS dans le graphe.** Relire la colonne « proposé », corriger ce
qui doit l'être, puis reporter les lectures retenues dans `data/lectures-kanji-arbitrees.json` :

```json
{
  "八": "ハチ・や・や(つ)",
  "一": "イチ・ひと・ひと(つ)"
}
```

puis `node tools/graph/readings.mjs`, qui n'écrase jamais une lecture existante.

⚠ KANJIDIC2 liste TOUTES les lectures attestées, y compris rares — le cours n'en garde
généralement qu'une ou deux par type. Élaguer est le travail d'arbitrage.

| kanji | sens (graphe) | sens (KANJIDIC) | lecture proposée |
|---|---|---|---|
| 一 | un / 1 | un | `イチ・イツ・ひと-・ひと(つ)` |
| 二 | deux / 2 | deux | `ニ・ジ・ふた・ふた(つ)・ふたたび` |
| 三 | trois / 3 | trois | `サン・ゾウ・み・み(つ)・みっ(つ)` |
| 四 | quatre / 4 | quatre | `シ・よ・よ(つ)・よっ(つ)・よん` |
| 五 | cinq / 5 | cinq | `ゴ・いつ・いつ(つ)` |
| 六 | six / 6 | six | `ロク・リク・む・む(つ)・むっ(つ)・むい` |
| 七 | sept / 7 | sept | `シチ・なな・なな(つ)・なの` |
| 八 | huit / 8 | huit | `ハチ・ハツ・や・や(つ)・やっ(つ)・よう` |
| 九 | neuf / 9 | neuf | `キュウ・ク・ここの・ここの(つ)` |
| 十 | dix / 10 | dix | `ジュウ・ジッ・ジュッ・とお・と・そ` |
| 百 | cent / 100 | cent | `ヒャク・ビャク・もも` |
| 千 | mille / 1000 | mille | `セン・ち` |
| 万 | dix mille | myriade | `マン・バン・よろず` |
| 円 | yen / rond | cercle | `エン・まる(い)・まる・まど・まど(か)・まろ(やか)` |
| 日 | jour / soleil | jour | `ニチ・ジツ・ひ・-び・-か` |
| 月 | lune / mois | lune | `ゲツ・ガツ・つき` |
| 火 | feu | feu | `カ・ひ・-び・ほ-` |
| 水 | eau | eau | `スイ・みず・みず-` |
| 木 | arbre / bois | arbre | `ボク・モク・き・こ-` |
| 金 | or / argent | or | `キン・コン・ゴン・かね・かな-・-がね` |
| 土 | terre / sol | sol | `ド・ト・つち` |
| 年 | année | année | `ネン・とし` |
| 時 | heure / temps | temps | `ジ・とき・-どき` |
| 分 | minute / part | portion | `ブン・フン・ブ・わ(ける)・わ(け)・わ(かれる)・わ(かる)・わ(かつ)` |
| 半 | moitié / demi | moitié | `ハン・なか(ば)` |
| 今 | maintenant | maintenant | `コン・キン・いま` |
| 前 | avant / devant | devant | `ゼン・まえ・-まえ` |
| 後 | après / arrière | après | `ゴ・コウ・のち・うし(ろ)・うしろ・あと・おく(れる)` |
| 午 | midi | midi | `ゴ・うま` |
| 間 | intervalle / entre | intervalle | `カン・ケン・あいだ・ま・あい` |
| 毎 | chaque | chaque | `マイ・ごと・-ごと(に)` |
| 上 | dessus / haut | au-dessus | `ジョウ・ショウ・シャン・うえ・-うえ・うわ-・かみ・あ(げる)・-あ(げる)・あ(がる)・-あ(がる)・あ(がり)・-あ(がり)・のぼ(る)・のぼ(り)・のぼ(せる)・のぼ(す)・たてまつ(る)` |
| 下 | dessous / bas | au-dessous | `カ・ゲ・した・しも・もと・さ(げる)・さ(がる)・くだ(る)・くだ(り)・くだ(す)・-くだ(す)・くだ(さる)・お(ろす)・お(りる)` |
| 中 | milieu / dedans | dans | `チュウ・なか・うち・あた(る)` |
| 左 | gauche | gauche | `サ・シャ・ひだり` |
| 右 | droite | droite | `ウ・ユウ・みぎ` |
| 東 | est | Est | `トウ・ひがし` |
| 西 | ouest | Ouest | `セイ・サイ・ス・にし` |
| 南 | sud | sud | `ナン・ナ・みなみ` |
| 北 | nord | nord | `ホク・きた` |
| 外 | extérieur / dehors | extérieur | `ガイ・ゲ・そと・ほか・はず(す)・はず(れる)・と-` |
| 大 | grand | grand | `ダイ・タイ・おお-・おお(きい)・-おお(いに)` |
| 小 | petit | petit | `ショウ・ちい(さい)・こ-・お-・さ-` |
| 高 | haut / cher | haut | `コウ・たか(い)・たか・-だか・たか(まる)・たか(める)` |
| 長 | long / chef | long | `チョウ・なが(い)・おさ` |
| 新 | nouveau | nouveau | `シン・あたら(しい)・あら(た)・あら-・にい-` |
| 古 | vieux / ancien | vieux | `コ・ふる(い)・ふる-・-ふる(す)` |
| 白 | blanc | blanc | `ハク・ビャク・しろ・しら-・しろ(い)` |
| 人 | personne | être humain | `ジン・ニン・ひと・-り・-と` |
| 男 | homme | homme | `ダン・ナン・おとこ・お` |
| 女 | femme | femme | `ジョ・ニョ・ニョウ・おんな・め` |
| 子 | enfant | enfant | `シ・ス・ツ・こ・-こ・ね` |
| 父 | père | père | `フ・ちち` |
| 母 | mère | maman | `ボ・はは・も` |
| 友 | ami | ami | `ユウ・とも` |
| 先 | avant / précédent | avant | `セン・さき・ま(ず)` |
| 生 | vie / naître | vie | `セイ・ショウ・い(きる)・い(かす)・い(ける)・う(まれる)・うま(れる)・う(まれ)・うまれ・う(む)・お(う)・は(える)・は(やす)・き・なま・なま-・な(る)・な(す)・む(す)・-う` |
| 名 | nom | nom | `メイ・ミョウ・な・-な` |
| 学 | étude / apprendre | étudier | `ガク・まな(ぶ)` |
| 校 | école | école | `コウ・キョウ` |
| 本 | livre / origine | livre | `ホン・もと` |
| 語 | langue / mot | langage | `ゴ・かた(る)・かた(らう)` |
| 国 | pays | pays | `コク・くに` |
| 山 | montagne | montagne | `サン・セン・やま` |
| 川 | rivière | rivière | `セン・かわ` |
| 田 | rizière | rizière | `デン・た` |
| 天 | ciel | cieux | `テン・あまつ・あめ・あま-` |
| 気 | esprit / air | esprit | `キ・ケ・いき・き` |
| 雨 | pluie | pluie | `ウ・あめ・あま-・-さめ` |
| 花 | fleur | fleur | `カ・ケ・はな` |
| 空 | ciel / vide | vide | `クウ・そら・あ(く)・あ(き)・あ(ける)・から・す(く)・す(かす)・むな(しい)` |
| 目 | œil | oeil | `モク・ボク・め・-め・ま-` |
| 耳 | oreille | oreille | `ジ・みみ` |
| 口 | bouche | bouche | `コウ・ク・くち` |
| 手 | main | main | `シュ・ズ・て・て-・-て・た-` |
| 足 | pied / jambe | jambe | `ソク・あし・た(りる)・た(る)・た(す)` |
| 力 | force | force | `リョク・リキ・リイ・ちから` |
| 行 | aller | aller | `コウ・ギョウ・アン・い(く)・ゆ(く)・-ゆ(き)・-ゆき・-い(き)・-いき・おこな(う)・おこ(なう)` |
| 来 | venir | venir | `ライ・タイ・く(る)・きた(る)・きた(す)・き(たす)・き(たる)・き・こ` |
| 帰 | rentrer | retour à la maison | `キ・かえ(る)・かえ(す)・おく(る)・とつ(ぐ)` |
| 見 | voir / regarder | regarder | `ケン・み(る)・み(える)・み(せる)` |
| 聞 | écouter / entendre | entendre | `ブン・モン・き(く)・き(こえる)` |
| 食 | manger / nourriture | manger | `ショク・ジキ・く(う)・く(らう)・た(べる)・は(む)` |
| 買 | acheter | acheter | `バイ・か(う)` |
| 読 | lire | lire | `ドク・トク・トウ・よ(む)・-よ(み)` |
| 書 | écrire | écrire | `ショ・か(く)・-が(き)・-がき` |
| 話 | parler / histoire | parler | `ワ・はな(す)・はなし` |
| 言 | dire / parole | dire | `ゲン・ゴン・い(う)・こと` |
| 出 | sortir | sortir | `シュツ・スイ・で(る)・-で・だ(す)・-だ(す)・い(でる)・い(だす)` |
| 入 | entrer | entrer | `ニュウ・ジュ・い(る)・-い(る)・-い(り)・い(れる)・-い(れ)・はい(る)` |
| 立 | se tenir debout | debout | `リツ・リュウ・リットル・た(つ)・-た(つ)・た(ち-)・た(てる)・-た(てる)・た(て-)・たて-・-た(て)・-だ(て)・-だ(てる)` |
| 休 | repos | repos | `キュウ・やす(む)・やす(まる)・やす(める)` |
| 会 | rencontrer / réunion | réunion | `カイ・エ・あ(う)・あ(わせる)・あつ(まる)` |
| 車 | voiture / roue | véhicule | `シャ・くるま` |
| 電 | électricité | électricité | `デン` |
| 何 | quoi / combien | quoi | `カ・なに・なん・なに-・なん-` |
| 文 | phrase / texte | phrase | `ブン・モン・ふみ・あや` |
| 音 | son / bruit | son | `オン・イン・-ノン・おと・ね` |
| 少 | peu | un petit peu | `ショウ・すく(ない)・すこ(し)` |
| 多 | nombreux | beaucoup | `タ・おお(い)・まさ(に)・まさ(る)` |
| 早 | tôt / rapide | tôt | `ソウ・サッ・はや(い)・はや・はや-・はや(まる)・はや(める)・さ-` |
| 引 | tirer, retirer | tirer | `イン・ひ(く)・ひ(ける)` |
| 映 | refléter, projeter | projection | `エイ・うつ(る)・うつ(す)・は(える)・-ば(え)` |
| 楽 | plaisir, aise, musique | musique | `ガク・ラク・ゴウ・たの(しい)・たの(しむ)・この(む)` |
| 料 | frais, matière | redevance | `リョウ` |
| 建 | construire, bâtir | construire | `ケン・コン・た(てる)・た(て)・-だ(て)・た(つ)` |
| 験 | épreuve, test | vérification | `ケン・ゲン・あかし・しるし・ため(す)・ためし` |
| 洗 | laver | laver | `セン・あら(う)` |
| 台 | support, plateau | piédestal | `ダイ・タイ・うてな・われ・つかさ` |
| 貸 | prêter, louer | prêter | `タイ・か(す)・か(し-)・かし-` |
| 借 | emprunter | emprunter | `シャク・か(りる)` |
| 変 | changer, étrange | insolite | `ヘン・か(わる)・か(わり)・か(える)` |
| 閉 | fermer | fermer | `ヘイ・と(じる)・と(ざす)・し(める)・し(まる)・た(てる)` |
| 声 | voix | voix | `セイ・ショウ・こえ・こわ-` |
| 科 | matière, discipline, section | département | `カ` |
| 束 | botte, lier, faisceau | fagot | `ソク・たば・たば(ねる)・つか・つか(ねる)` |
| 領 | territoire, domaine, recevoir | domaine | `リョウ・えり` |
| 保 | protéger, garantir, maintenir | protéger | `ホ・ホウ・たも(つ)` |
| 歴 | parcours, histoire, passer | historique | `レキ・レッキ` |
| 環 | anneau, cercle, entourer | anneau | `カン・わ` |
| 宇 | univers, ciel, espace | firmament | `ウ` |
| 宙 | espace, ciel, air | plein ciel | `チュウ` |
| 宗 | religion, secte, origine | religion | `シュウ・ソウ・むね` |
| 師 | maître, enseignant, expert | maître | `シ・いくさ` |
| 浅 | peu profond, superficiel | peu profond | `セン・あさ(い)` |
| 岩 | rocher, roche | rocher | `ガン・いわ` |
| 顔 | visage, expression | visage | `ガン・かお` |
| 怖 | peur, effrayant | effrayant | `フ・ホ・こわ(い)・こわ(がる)・お(じる)・おそ(れる)` |
| 恐 | craindre, redouter | peur | `キョウ・おそ(れる)・おそ(る)・おそ(ろしい)・こわ(い)・こわ(がる)` |
| 恋 | amour, être amoureux | chérir | `レン・こ(う)・こい・こい(しい)` |
| 労 | labeur, peine, travail | labeur | `ロウ・ろう(する)・いたわ(る)・いた(ずき)・ねぎら・つか(れる)・ねぎら(う)` |
| 液 | liquide, fluide | liquide | `エキ` |
| 眠 | sommeil, dormir | dormir | `ミン・ねむ(る)・ねむ(い)` |
| 夢 | rêve, songe | rêve | `ム・ボウ・ゆめ・ゆめ(みる)・くら(い)` |
| 可 | possible, approuver | possible | `カ・コク・-べ(き)・-べ(し)` |
| 与 | donner, accorder | donner | `ヨ・あた(える)・あずか(る)・くみ(する)・ともに` |
| 富 | richesse, abondance | fortune | `フ・フウ・と(む)・とみ` |
| 豊 | abondant, riche, fertile | abondance | `ホウ・ブ・ゆた(か)・とよ` |
| 貧 | pauvreté, pauvre | pauvre | `ヒン・ビン・まず(しい)` |
| 乏 | manquer, rare | insuffisant | `ボウ・とぼ(しい)・とも(しい)` |
| 困 | être embarrassé, ennui | embarras | `コン・こま(る)` |
| 易 | facile, simple, aisé | facile | `エキ・イ・やさ(しい)・やす(い)` |
| 簡 | simple, bref, concis | simplicité | `カン・ケン・えら(ぶ)・ふだ` |
| 択 | choisir, sélectionner | choisir | `タク・えら(ぶ)` |
| 依 | dépendre de, selon | dépendant | `イ・エ・よ(る)` |
| 利 | profit, avantage, tranchant | profit | `リ・き(く)` |
| 貯 | épargner, accumuler | économies | `チョ・た(める)・たくわ(える)` |
| 払 | payer, balayer | payer | `フツ・ヒツ・ホツ・はら(う)・-はら(い)・-ばら(い)` |
| 域 | zone, région, aire | zone | `イキ` |
| 席 | siège, place | siège | `セキ・むしろ` |
| 令 | ordre, commandement, loi | ordre | `レイ` |
| 刷 | imprimer, brosser | imprimer | `サツ・す(る)・-ず(り)・-ずり・は(く)` |
| 刊 | publier, éditer | publier | `カン` |
| 巻 | rouleau, volume, enrouler | rouleau | `カン・ケン・ま(く)・まき・ま(き)` |
| 冊 | compteur de livres, volume | tome | `サツ・サク・ふみ` |
| 編 | compiler, tricoter, rédiger | compilation | `ヘン・あ(む)・-あ(み)` |
| 訳 | traduire, raison, sens | traduire | `ヤク・わけ` |
| 翻 | traduire, retourner | voltiger | `ホン・ハン・ひるがえ(る)・ひるがえ(す)` |
| 罰 | punition, châtiment | punition | `バツ・バチ・ハツ・ばっ(する)` |
| 捕 | attraper, capturer, arrêter | attraper | `ホ・と(らえる)・と(らわれる)・と(る)・とら(える)・とら(われる)・つか(まえる)・つか(まる)` |
| 逮 | appréhender, atteindre | appréhender | `タイ` |
| 留 | rester, retenir, fixer | retenir | `リュウ・ル・と(める)・と(まる)・とど(める)・とど(まる)・るうぶる` |
| 及 | atteindre, s'étendre, et | allonger | `キュウ・およ(ぶ)・およ(び)・および・およ(ぼす)` |
| 衆 | masse, foule, public | foule | `シュウ・シュ・おお(い)` |
| 均 | égal, uniforme, moyenne | nivelé | `キン・なら(す)` |
| 録 | enregistrer, noter | enregistrer | `ロク・しる(す)・と(る)` |
| 抜 | extraire, retirer, dépasser | arracher | `バツ・ハツ・ハイ・ぬ(く)・-ぬ(く)・ぬ(き)・ぬ(ける)・ぬ(かす)・ぬ(かる)` |
| 副 | vice-, secondaire, adjoint | vice- | `フク` |
| 衣 | vêtement, habit | vêtement | `イ・エ・ころも・きぬ・-ぎ` |
| 演 | jouer, représenter, exposer | interpréter | `エン` |
| 煙 | fumée | fumée | `エン・けむ(る)・けむり・けむ(い)` |
| 塩 | sel | sel | `エン・しお` |
| 押 | pousser, appuyer | appuyer | `オウ・お(す)・お(し-)・お(っ-)・お(さえる)・おさ(える)` |
| 河 | fleuve, rivière | rivière | `カ・かわ` |
| 灰 | cendre | cendre | `カイ・はい` |
| 干 | sécher, assécher | sec | `カン・ほ(す)・ほ(し-)・-ぼ(し)・ひ(る)` |
| 甘 | sucré, doux, indulgent | doux | `カン・あま(い)・あま(える)・あま(やかす)・うま(い)` |
| 汗 | sueur, transpiration | sueur | `カン・あせ` |
| 幾 | combien, quelque | combien | `キ・いく-・いく(つ)・いく(ら)` |
| 貴 | précieux, noble | précieux | `キ・たっと(い)・とうと(い)・たっと(ぶ)・とうと(ぶ)` |
| 疑 | douter, soupçonner | douter | `ギ・うたが(う)` |
| 儀 | cérémonie, règle, affaire | cérémonie | `ギ` |
| 詰 | remplir, bourrer | hermétiquement clos | `キツ・キチ・つ(める)・つ(め)・-づ(め)・つ(まる)・つ(む)` |
| 逆 | inverse, contraire | inverse | `ギャク・ゲキ・さか・さか(さ)・さか(らう)` |
| 久 | longtemps, durable | longtemps | `キュウ・ク・ひさ(しい)` |
| 旧 | ancien, vieux, ex- | ancien temps | `キュウ・ふる(い)・もと` |
| 巨 | gigantesque, énorme | gigantesque | `キョ` |
| 拠 | fondement, s'appuyer sur | point d'appui | `キョ・コ・よ(る)` |
| 拒 | refuser, repousser | refuser | `キョ・ゴ・こば(む)` |
| 狭 | étroit, exigu | étroit | `キョウ・コウ・せま(い)・せば(める)・せば(まる)・さ` |
| 驚 | surprendre, s'étonner | étonnement | `キョウ・おどろ(く)・おどろ(かす)` |
| 禁 | interdire, prohiber | interdiction | `キン` |
| 筋 | muscle, tendon, fil | muscle | `キン・すじ` |
| 勤 | travailler, service | assiduité | `キン・ゴン・つと(める)・-づと(め)・つと(まる)・いそ(しむ)` |
| 靴 | chaussure | chaussure | `カ・くつ` |
| 傾 | pencher, incliner | incliner | `ケイ・かたむ(く)・かたむ(ける)・かたぶ(く)・かた(げる)・かし(げる)` |
| 継 | continuer, succéder | hériter | `ケイ・つ(ぐ)・まま-` |
| 迎 | accueillir, aller chercher | accueil | `ゲイ・むか(える)` |
| 撃 | frapper, attaquer, tirer | battre | `ゲキ・う(つ)` |
| 激 | violent, intense | violent | `ゲキ・はげ(しい)` |
| 潔 | pur, net, irréprochable | viril | `ケツ・いさぎよ(い)` |
| 肩 | épaule | épaule | `ケン・かた` |
| 憲 | loi fondamentale | constitution | `ケン` |
| 賢 | sage, intelligent | intelligent | `ケン・かしこ(い)` |
| 玄 | mystère, sombre, profond | mystérieux | `ゲン・くろ・くろ(い)` |
| 源 | source, origine | source | `ゲン・みなもと` |
| 厳 | sévère, strict, solennel | strict | `ゲン・ゴン・おごそ(か)・きび(しい)・いか(めしい)・いつくし` |
| 己 | soi-même | soi | `コ・キ・おのれ・つちのと・な` |
| 呼 | appeler, respirer | appeler | `コ・よ(ぶ)` |
| 誤 | erreur, se tromper | erreur | `ゴ・あやま(る)・-あやま(る)` |
| 抗 | résister, s'opposer | s'opposer à | `コウ・あらが(う)` |
| 更 | renouveler, davantage | se faire tard | `コウ・さら・さら(に)・ふ(ける)・ふ(かす)` |
| 硬 | dur, rigide | dur | `コウ・かた(い)` |
| 荒 | brut, sauvage, rude | brutalité | `コウ・あ(らす)・あ(れる)・あら(い)・すさ(ぶ)・すさ(む)・あ(らし)` |
| 座 | siège, s'asseoir | s'accroupir | `ザ・すわ(る)` |
| 再 | de nouveau, re- | encore une fois | `サイ・サ・ふたた(び)` |
| 咲 | fleurir, éclore | fleurir | `ショウ・さ(く)・-ざき` |
| 撮 | photographier, filmer | photographier | `サツ・と(る)・つま(む)・-ど(り)` |
| 参 | participer, se rendre | dérouté | `サン・シン・まい(る)・まい-・まじわる・みつ` |
| 士 | homme de métier, guerrier | gentilhomme | `シ・さむらい` |
| 志 | volonté, aspiration | dessein | `シ・シリング・こころざ(す)・こころざし` |
| 枝 | branche, rameau | branche | `シ・えだ` |
| 飼 | élever (un animal) | domestiquer | `シ・か(う)` |
| 湿 | humide | moite | `シツ・シュウ・しめ(る)・しめ(す)・うるお(う)・うるお(す)` |
| 芝 | gazon, pelouse | pelouse | `シ・しば` |
| 捨 | jeter, abandonner | jeter | `シャ・す(てる)` |
| 寂 | solitaire, silencieux | solitude | `ジャク・セキ・さび・さび(しい)・さび(れる)・さみ(しい)` |
| 若 | jeune | jeune | `ジャク・ニャク・ニャ・わか(い)・わか-・も(しくわ)・も(し)・も(しくは)・ごと(し)` |
| 熟 | mûrir, maîtriser | mûrir | `ジュク・う(れる)` |
| 承 | accepter, recevoir | consentir | `ショウ・ジョウ・うけたまわ(る)・う(ける)` |
| 昇 | monter, s'élever | s'élever | `ショウ・のぼ(る)` |
| 松 | pin | pin | `ショウ・まつ` |
| 照 | éclairer, illuminer | illuminer | `ショウ・て(る)・て(らす)・て(れる)` |
| 症 | symptôme, maladie | symptôme | `ショウ` |
| 障 | obstacle, entrave | gêne | `ショウ・さわ(る)` |
| 詳 | détaillé, précis | détaillé | `ショウ・くわ(しい)・つまび(らか)` |
| 丈 | taille, hauteur, robuste | longueur | `ジョウ・たけ・だけ` |
| 吹 | souffler | souffler | `スイ・ふ(く)` |
| 睡 | sommeil | ensommeillé | `スイ・ねむ(る)・ねむ(い)` |
| 省 | économiser, réfléchir, ministère | faire le point (introspection) | `セイ・ショウ・かえり(みる)・はぶ(く)` |
| 勢 | force, élan, vigueur | vigueur | `セイ・ゼイ・いきお(い)・はずみ` |
| 誠 | sincérité | sincérité | `セイ・まこと` |
| 積 | empiler, accumuler | volume | `セキ・つ(む)・-づ(み)・つ(もる)・つ(もり)` |
| 折 | plier, casser | plier | `セツ・シャク・お(る)・おり・お(り)・-お(り)・お(れる)` |
| 占 | occuper, prédire | bonne aventure | `セン・し(める)・うらな(う)` |
| 宣 | déclarer, proclamer | proclamer | `セン・のたま(う)` |
| 専 | exclusif, spécial | spécialité | `セン・もっぱ(ら)` |
| 泉 | source, fontaine | source | `セン・いずみ` |
| 染 | teindre, contaminer | teindre | `セン・そ(める)・そ(まる)・し(みる)・し(み)` |
| 倉 | grenier, entrepôt | cellier | `ソウ・くら` |
| 掃 | balayer, nettoyer | balayer | `ソウ・シュ・は(く)` |
| 替 | échanger, remplacer | substituer | `タイ・か(える)・か(え-)・か(わる)` |
| 脱 | enlever, s'échapper | déshabiller | `ダツ・ぬ(ぐ)・ぬ(げる)` |
| 端 | extrémité, bord | bord | `タン・はし・は・はた・-ばた・はな` |
| 誕 | naissance | nativité | `タン` |
| 団 | groupe, corps, troupe | groupe | `ダン・トン・かたまり・まる(い)` |
| 超 | dépasser, super- | dépasser | `チョウ・こ(える)・こ(す)` |
| 敵 | ennemi, adversaire | ennemi | `テキ・かたき・あだ・かな(う)` |
| 逃 | fuir, échapper | s'évader | `トウ・に(げる)・に(がす)・のが(す)・のが(れる)` |
