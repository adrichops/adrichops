(async function(){
  const root=document.querySelector('[data-finder]');
  if(!root)return;
  const result=root.querySelector('[data-finder-result]'), form=root.querySelector('form');
  const esc=s=>String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let data,products,posts;
  try {
    const responses=await Promise.all(['/data/finder.json','/data/products.json','/data/posts.json'].map(url=>fetch(url).then(r=>{if(!r.ok)throw new Error();return r.json();})));
    data=responses[0];products=new Map(responses[1].products.map(p=>[p.id,p]));posts=new Map(responses[2].posts.map(p=>[p.id,p]));
  } catch(_){result.innerHTML='<p>Recommendations could not load. Please refresh to try again.</p>';return;}
  try{
    const saved=JSON.parse(localStorage.getItem('adrichops-tool-finder') || '{}');
    for(const q of data.questions){if(q.options.some(o=>o.value===saved[q.id]))form.elements[q.id].value=saved[q.id];}
  }catch(_){}
  function product(id,label){
    const p=products.get(id);if(!p)return '';
    const photos={
      'victorinox-fibrox-pro-8-inch-chef-knife':['/assets/uploads/post-images/victorinox-fibrox-pro-8-inch-shortlist-review.png','Victorinox'],
      'tojiro-dp-210mm-gyuto-f-808':['/assets/uploads/post-images/tojiro-dp-210mm-gyuto-shortlist-review.jpg','TOJIRO Co., Ltd.']
    };
    const photo=photos[id];
    const media=photo?'<figure class="tool-photo"><img src="'+photo[0]+'" alt="'+esc(p.name)+'"><figcaption>Image: <a href="'+esc(p.sourceUrl)+'" target="_blank" rel="noopener">'+photo[1]+'</a></figcaption></figure>':'';
    return '<article class="tool-pick"><span class="kicker">'+esc(label)+'</span><h3>'+esc(p.name)+'</h3>'+media+'<p>'+esc(p.finderNote || p.note)+'</p><a class="button primary" href="'+esc(p.url)+'" target="_blank" rel="sponsored nofollow noopener">Find on Amazon ↗</a>'+(p.sourceUrl?'<a class="tool-source" href="'+esc(p.sourceUrl)+'" target="_blank" rel="noopener">Product details from the maker ↗</a>':'')+'</article>';
  }
  function render(){
    const values=Object.fromEntries(new FormData(form));
    const task=data.tasks[values.task] || data.tasks['all-purpose'];
    const priority=['value','convenience','upgrade'].includes(values.priority)?values.priority:'value';
    const id=task.picks[priority],alternative=task.alternatives?.[priority];
    const stone=priority==='value'?'king-deluxe-1000-whetstone':'shapton-kuromaku-1000';
    result.innerHTML='<span class="kicker">Your starting point</span><h2>'+esc(task.title)+'</h2><p>'+esc(task.why)+'</p>'+product(id,'My first pick')+(alternative?'<details class="tool-alternative"><summary>One alternative</summary>'+product(alternative,'Also worth considering')+'</details>':'')+'<div class="tool-care"><h3>Looking after it</h3><p>'+esc(task.care)+'</p><h3>What can wait</h3><p>'+esc(task.skip)+'</p></div>'+(task.stone?'<details class="tool-alternative"><summary>Need a sharpening stone too?</summary><p>Only add one if you need it.</p>'+product(stone,'A first stone')+'</details>':'')+'<div class="tool-reading"><h3>Read next</h3>'+task.articleIds.map(id=>posts.get(id)).filter(Boolean).map(p=>'<a href="'+esc(p.route)+'">'+esc(p.title)+' →</a>').join('')+'</div>';
    try{localStorage.setItem('adrichops-tool-finder',JSON.stringify(values));}catch(_){}
  }
  form.addEventListener('change',render);
  form.addEventListener('submit',e=>{e.preventDefault();render();result.focus({preventScroll:true});result.scrollIntoView({behavior:'smooth',block:'start'});});
  render();
})();
