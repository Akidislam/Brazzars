import { ArrowDown, ArrowRight, ArrowUpRight, Menu, Search, ShoppingBag, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const accountPaths = { customer: '/account', vendor: '/vendor/dashboard', admin: '/admin/dashboard' };

const categories = [
  { name: 'Home & living', count: '124 shops', tone: 'bg-[#e6eadf]', image: 'photo-1600210492486-724fe5c67fb0' },
  { name: 'Style & apparel', count: '86 shops', tone: 'bg-[#eee3d9]', image: 'photo-1483985988355-763728e1935b' },
  { name: 'Artisan finds', count: '53 shops', tone: 'bg-[#e4e8ee]', image: 'photo-1490312278390-ab64016e0aa9' },
];

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return <header className="flex items-center justify-between border-b border-black/5 px-5 py-5 sm:px-10 lg:px-16">
    <Link to="/" className="font-display text-[25px] font-extrabold tracking-[-1.5px]">brazzars<span className="text-forest">.</span></Link>
    <nav className="hidden items-center gap-9 text-[13px] font-medium text-ink/70 md:flex">
      <a className="hover:text-forest" href="#discover">Discover</a><a className="hover:text-forest" href="#categories">Categories</a><a className="hover:text-forest" href="#community">For sellers</a>
    </nav>
    <div className="flex items-center gap-2 sm:gap-4">
      <button aria-label="Search" className="rounded-full p-2 hover:bg-black/5"><Search size={19} strokeWidth={1.7} /></button>
      <button aria-label="Shopping bag" className="relative rounded-full p-2 hover:bg-black/5"><ShoppingBag size={19} strokeWidth={1.7} /><span className="absolute right-0 top-0 h-2 w-2 rounded-full bg-[#b7db63]" /></button>
      {user ? <div className="flex items-center gap-2"><Link to={accountPaths[user.role] ?? '/'} className="rounded-full px-3 py-2 text-xs font-semibold">My account</Link><button type="button" onClick={() => { logout(); navigate('/'); }} className="hidden rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-white hover:bg-forest sm:inline-flex">Log out</button></div> : <div className="flex items-center gap-1 sm:gap-3"><Link to="/login" className="rounded-full px-2 py-2 text-xs font-semibold sm:px-3">Sign in</Link><Link to="/register" className="rounded-full bg-ink px-3 py-2.5 text-[11px] font-semibold text-white transition hover:bg-forest sm:px-5 sm:text-xs">Join Brazzars</Link></div>}
      <button aria-label="Open menu" className="rounded-full p-2 md:hidden"><Menu size={20} /></button>
    </div>
  </header>;
}

function HomePage() {
  return <div id="top" className="min-h-screen bg-paper">
    <div className="bg-forest px-4 py-2 text-center text-[10px] font-medium tracking-[.12em] text-white sm:text-[11px]">A LITTLE MORE LOCAL. A LOT MORE YOU. <span className="ml-2 text-lime">Discover Bangladesh's independent shops →</span></div>
    <Header />
    <main>
      <section className="mx-auto grid max-w-[1440px] items-center gap-9 px-5 pb-14 pt-10 sm:px-10 sm:pb-20 sm:pt-16 lg:grid-cols-[.9fr_1.1fr] lg:gap-16 lg:px-16 lg:py-20">
        <div className="relative z-10 max-w-[550px]">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-forest/10 bg-white/70 px-3 py-1.5 text-[11px] font-semibold text-forest"><Sparkles size={13} /> GOOD THINGS, FOUND CLOSE TO HOME</div>
          <h1 className="font-display text-[clamp(3.2rem,7vw,6.4rem)] font-semibold leading-[.98] tracking-[-.075em]">Find your<br />kind of <span className="relative inline-block text-forest">good.<svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 240 14" fill="none"><path d="M3 9C54 2 164 1 235 7" stroke="#B8D766" strokeWidth="6" strokeLinecap="round"/></svg></span></h1>
          <p className="mt-7 max-w-[410px] text-[15px] leading-7 text-muted sm:text-base">Meet the makers, small shops, and thoughtful finds that make Bangladesh feel like home.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3"><a href="#discover" className="inline-flex items-center gap-5 rounded-full bg-ink px-6 py-4 text-[13px] font-semibold text-white transition hover:bg-forest">Explore the marketplace <ArrowRight size={16} /></a><a href="#categories" className="px-3 py-3 text-[13px] font-semibold">See what's inside <ArrowDown className="ml-1 inline" size={14} /></a></div>
          <div className="mt-12 flex items-center gap-4 border-t border-black/10 pt-6"><div className="flex -space-x-2">{['photo-1534528741775-53994a69daeb','photo-1500648767791-00dcc994a43e','photo-1531123897727-8f129e1688ce'].map((photo) => <img key={photo} className="h-8 w-8 rounded-full border-2 border-paper object-cover" src={`https://images.unsplash.com/${photo}?auto=format&fit=crop&w=80&q=80`} alt="" />)}</div><p className="text-[11px] leading-4 text-muted"><span className="font-bold text-ink">Made for the curious.</span><br />Loved by shoppers across Bangladesh.</p></div>
        </div>
        <div className="relative min-h-[360px] sm:min-h-[490px] lg:min-h-[560px]">
          <div className="absolute inset-0 overflow-hidden rounded-[1.7rem] bg-[#d8decd]"><img className="h-full w-full object-cover" src="https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1400&q=90" alt="Warm, thoughtfully styled living room with locally made decor" /><div className="hero-pattern absolute inset-0 opacity-40" /><div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/5" /></div>
          <div className="absolute left-4 top-4 rounded-full bg-white/90 px-4 py-2 text-[10px] font-semibold tracking-wide shadow-soft backdrop-blur sm:left-6 sm:top-6">THE LOCAL EDIT · 01</div>
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between text-white sm:bottom-7 sm:left-7 sm:right-7"><div><p className="text-[10px] font-semibold tracking-[.16em] text-white/80">THOUGHTFUL FINDS, EVERYWHERE</p><p className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">A home with a story.</p></div><a href="#categories" aria-label="Browse the edit" className="grid h-11 w-11 place-items-center rounded-full bg-lime text-ink transition hover:scale-105"><ArrowUpRight size={20} /></a></div>
          <div className="absolute -bottom-5 right-5 rounded-2xl bg-white px-4 py-3 shadow-soft sm:-right-5 sm:bottom-10"><p className="font-display text-xl font-extrabold">100%</p><p className="text-[10px] text-muted">independent spirit</p></div>
        </div>
      </section>
      <section id="discover" className="border-y border-black/5 bg-[#f0f1eb] px-5 py-5 sm:px-10 lg:px-16"><div className="mx-auto flex max-w-[1312px] flex-wrap items-center justify-between gap-4"><p className="text-xs font-semibold text-ink">A marketplace with a local point of view.</p><div className="flex flex-wrap gap-x-7 gap-y-2 text-[10px] font-medium tracking-wide text-muted sm:text-[11px]"><span>01 &nbsp; MEET LOCAL MAKERS</span><span>02 &nbsp; FIND YOUR NEXT FAVOURITE</span><span>03 &nbsp; SHOP WITH PURPOSE</span></div></div></section>
      <section id="categories" className="mx-auto max-w-[1440px] px-5 py-16 sm:px-10 sm:py-20 lg:px-16"><div className="mb-8 flex items-end justify-between"><div><p className="text-[10px] font-bold tracking-[.18em] text-forest">A GOOD PLACE TO START</p><h2 className="mt-2 font-display text-3xl font-semibold tracking-[-.05em] sm:text-4xl">A little bit of everything.</h2></div><a href="#community" className="hidden items-center gap-2 text-xs font-semibold sm:flex">All categories <ArrowRight size={15} /></a></div><div className="grid gap-4 md:grid-cols-3">{categories.map((category, index) => <a key={category.name} href="#community" className="group relative h-[260px] overflow-hidden rounded-2xl sm:h-[330px]"><img src={`https://images.unsplash.com/${category.image}?auto=format&fit=crop&w=800&q=85`} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-105" /><div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent" /><div className="absolute left-5 top-5 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold">0{index + 1}</div><div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-white"><div><p className="text-[10px] text-white/75">{category.count}</p><h3 className="mt-1 font-display text-2xl font-semibold tracking-tight">{category.name}</h3></div><span className="grid h-10 w-10 place-items-center rounded-full border border-white/50 transition group-hover:bg-white group-hover:text-ink"><ArrowUpRight size={17} /></span></div></a>)}</div></section>
      <section id="community" className="px-5 pb-16 sm:px-10 sm:pb-20 lg:px-16"><div className="mx-auto flex max-w-[1312px] flex-col justify-between gap-8 rounded-[1.7rem] bg-forest p-8 text-white sm:p-12 md:flex-row md:items-center"><div><p className="text-[10px] font-bold tracking-[.18em] text-lime">YOUR SHOP, YOUR STORY</p><h2 className="mt-3 max-w-xl font-display text-3xl font-semibold tracking-[-.05em] sm:text-4xl">Good things are better when we make them together.</h2><p className="mt-3 max-w-lg text-sm leading-6 text-white/70">Meet the marketplace built to help independent businesses find their people.</p></div><a href="mailto:hello@brazzars.com" className="inline-flex shrink-0 items-center justify-center gap-4 rounded-full bg-lime px-6 py-4 text-[13px] font-bold text-ink">Come sell with us <ArrowRight size={16} /></a></div></section>
    </main>
    <footer className="flex flex-col justify-between gap-3 border-t border-black/5 px-5 py-7 text-[11px] text-muted sm:flex-row sm:px-10 lg:px-16"><a href="#top" className="font-display text-base font-extrabold tracking-[-1px] text-ink">brazzars<span className="text-forest">.</span></a><p>Thoughtfully local. Made for Bangladesh. © 2026 Brazzars</p></footer>
  </div>;
}

export default HomePage;
