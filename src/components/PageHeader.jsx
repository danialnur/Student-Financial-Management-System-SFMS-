const BAPP_LOGO =
  "https://studentaffairs.utm.my/bapp/wp-content/uploads/sites/11/2024/09/Projek-Logo-BAPP-02.png";

export default function PageHeader({ title, subtitle, action }) {
  return (
    <div>
      <div className="border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={BAPP_LOGO} alt="BAPP UTM" className="h-16 w-auto object-contain scale-[1.4]" />
            <div className="hidden border-l border-gray-200 pl-4 sm:block">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">BAPP UTM</p>
              <p className="text-sm font-bold text-gray-800">Sistem Pengurusan Kewangan Bijak</p>
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      </div>

      <div className="bg-gradient-to-r from-red-950 via-red-900 to-red-800 px-6 py-4 shadow-md">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-xl font-bold text-white">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs text-red-300">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
