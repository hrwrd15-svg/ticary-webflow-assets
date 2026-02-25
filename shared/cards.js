/* TICARY — Card click + price-in-footer (v1)
   - Removes price pill (CSS handles display none)
   - Inserts price into the card footer/actions row area
   - Removes View Details button (CSS handles)
   - Makes whole card clickable to open popup
*/
(function(){
  if (window.__tcCardsClickPrice_v1) return;
  window.__tcCardsClickPrice_v1 = 1;

  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  function clean(t){ return (t ?? "").toString().trim(); }

  function getVehicleId(card){
    return (
      Number(card?.dataset?.vehicleId || 0) ||
      Number(card?.getAttribute("data-vehicle-id") || 0) ||
      Number(card?.getAttribute("data-vehicleid") || 0) ||
      0
    );
  }


  function getPriceText(card){
    // Prefer hidden fs-list-field="price" if present
    let p =
      clean(card.querySelector('[fs-list-field="price"]')?.textContent) ||
      clean(card.querySelector(".as-price")?.textContent) ||
      clean(card.querySelector(".as-price-badge")?.textContent);

    return p;
  }

  function hydrateCard(card){
  if (!card || card.__tcHydratedPrice) return;

  const price =
    (card.querySelector('[fs-list-field="price"]')?.textContent || '').trim() ||
    (card.querySelector('.as-price-badge')?.textContent || '').trim();

  if (!price) return;

  // Find the original View Details button
  const viewBtn =
    card.querySelector('.as-view') ||
    card.querySelector('.as-cta');

  if (viewBtn){
    viewBtn.textContent = price;
    viewBtn.classList.add('tc-price-button');
  }

  card.__tcHydratedPrice = true;
}

  function hydrateAll(){
    $$(".as-card").forEach(hydrateCard);
  }

  // Make entire card open popup (but don't hijack clicks on heart/links/etc)
  document.addEventListener("click", function(e){
    const card = e.target?.closest?.(".as-card");
    if (!card) return;

    // ignore clicks on interactive elements
    if (e.target.closest("a, button, input, select, textarea, label, [role='button'], .as-fav-btn")) return;

    const id = getVehicleId(card);
    if (!id) return;

    // Prefer your global modal opener
    if (typeof window.tcOpenDetailsModal === "function"){
      e.preventDefault();
      e.stopPropagation();
      try{ window.tcOpenDetailsModal({ vehicle_id: id }); }catch(_){}
      return;
    }
  }, true);

  // Run now + whenever the list updates
  hydrateAll();

  const listRoot =
    $("#as-grid") ||
    $(".as-grid") ||
    $("#vehiclesList") ||
    $(".w-dyn-items") ||
    document.querySelector('[role="list"]');

  if (listRoot){
    const mo = new MutationObserver(()=> requestAnimationFrame(hydrateAll));
    mo.observe(listRoot, { childList:true, subtree:true });
  } else {
    // fallback retry (Webflow can mount late)
    let n=0;
    const iv=setInterval(()=>{
      hydrateAll();
      if (++n>30) clearInterval(iv);
    }, 250);
  }

})();
