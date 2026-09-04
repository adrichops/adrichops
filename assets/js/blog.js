(function(){
  const search=document.querySelector('[data-blog-search]');
  if(!search)return;
  const topic=document.querySelector('[data-blog-topic]'), rows=[...document.querySelectorAll('[data-blog-articles] .note-row')];
  function filter(){
    let count=0;
    rows.forEach(row=>{
      const text=row.dataset.filterText.toLowerCase();
      const route=row.getAttribute('href');
      const category=/maker-spotlight|who-made|japanese-knife-culture|regions|sakai-wide|how-japanese|history-of/.test(route)?'makers':/sharpen|stone|stropp|honing|maintenance|boards-storage|patina/.test(route)?'sharpening':'buying';
      row.hidden=!text.includes(search.value.trim().toLowerCase()) || (topic.value!=='all' && topic.value!==category);
      if(!row.hidden)count++;
    });
    document.querySelector('[data-blog-count]').textContent=count?count+' articles':'No articles found. Try another topic or search.';
  }
  search.addEventListener('input',filter);topic.addEventListener('change',filter);filter();
})();
