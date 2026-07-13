const phone="5511957547374";
const wa=(text)=>`https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

document.querySelectorAll(".whatsapp").forEach(link=>{
  link.href=wa("Olá! Vi o site do Studio Jessica Leite e quero agendar um horário.");
  link.target="_blank";
  link.rel="noopener";
});

document.querySelectorAll(".whatsapp-micro").forEach(link=>{
  link.href=wa("Olá! Quero agendar uma avaliação para micropigmentação de sobrancelhas.");
  link.target="_blank";
  link.rel="noopener";
});

document.querySelectorAll(".service-link").forEach(link=>{
  link.href=wa(`Olá! Quero saber mais sobre ${link.dataset.service}.`);
  link.target="_blank";
  link.rel="noopener";
});

const menuButton=document.querySelector(".menu-button");
const menu=document.querySelector(".menu");
menuButton.addEventListener("click",()=>menu.classList.toggle("open"));
menu.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>menu.classList.remove("open")));

document.getElementById("year").textContent=new Date().getFullYear();


document.querySelectorAll(".faq-item button").forEach(button=>{
  button.addEventListener("click",()=>{
    const item=button.closest(".faq-item");
    item.classList.toggle("active");
    button.querySelector("span").textContent=item.classList.contains("active")?"−":"+";
  });
});
