/* Modèle de progression et de probabilité de réussite N3 — SOURCE UNIQUE.
   Partagé entre la page d'accueil (index.html) et l'app adaptative (app-n3.html)
   pour que les DEUX pages affichent EXACTEMENT les mêmes chiffres (proba, score,
   niveau, jours restants). Ne dépend d'aucune autre ressource. */
(function(g){
  const CATS=['grammaire','vocabulaire','kanji','lecture','ecoute'];
  const PASS_RATING=1600;                       // niveau ~ requis pour le N3
  const EXAM=new Date('2026-12-06T09:00:00');

  function skR(S,c){ const e=S&&S.skill&&S.skill[c]; return (e&&typeof e.R==='number')?e.R:1450; }
  function skT(S,c){ const e=S&&S.skill&&S.skill[c]; return (e&&typeof e.t==='number')?e.t:0; }

  /* maîtrise d'une compétence = proba de réussir une question de niveau N3 */
  function mastery(S,c){ const R=skR(S,c); return 1/(1+Math.pow(10,(PASS_RATING-R)/400)); }

  /* sections de l'examen */
  function sections(S){
    const langage=(mastery(S,'vocabulaire')+mastery(S,'kanji'))/2;   // 文字・語彙
    const grammLect=(mastery(S,'grammaire')+mastery(S,'lecture'))/2; // 文法・読解
    // 聴解 : mesuré si l'utilisateur a fait de l'écoute, sinon estimation prudente
    const listening=skT(S,'ecoute')>=3 ? mastery(S,'ecoute') : 0.85*((langage+grammLect)/2);
    return {langage,grammLect,listening};
  }

  /* probabilité de réussite globale + score estimé /180 */
  function successModel(S){
    const s=sections(S);
    const secScore={langage:s.langage*60,grammLect:s.grammLect*60,listening:s.listening*60};
    const total=secScore.langage+secScore.grammLect+secScore.listening;
    // chaque section doit dépasser ~19/60, et total >= 95/180
    const pSec=v=>1/(1+Math.exp(-(v-22)/4));      // proba section >= seuil
    const pTotal=1/(1+Math.exp(-(total-95)/12));
    let p=pTotal*pSec(secScore.langage)*pSec(secScore.grammLect)*pSec(secScore.listening);
    const n=(S&&S.total)||0;
    const conf=Math.min(1,n/60);                  // confiance : faible si peu de données
    p=conf*p+(1-conf)*0.5*pTotal;                 // sans données, base prudente 50%
    return {p,total,secScore,conf,n};
  }

  function ratingLabel(S){
    const avg=CATS.reduce((a,c)=>a+skR(S,c),0)/CATS.length;
    if(avg<1400)return 'N4-';
    if(avg<1520)return 'N4+';
    if(avg<1620)return 'N3-';
    if(avg<1720)return 'N3';
    return 'N3+';
  }

  function daysToExam(now){ return Math.max(0,Math.ceil((EXAM-(now||new Date()))/864e5)); }

  g.JLPTProgress={CATS,PASS_RATING,EXAM,mastery,sections,successModel,ratingLabel,daysToExam};
})(typeof window!=='undefined'?window:this);
