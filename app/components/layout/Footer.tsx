export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-600">
          <div className="flex items-center gap-2 mb-3 md:mb-0">
            <span>© {new Date().getFullYear()}</span>
            <span className="font-semibold text-[#15803D]">StudentHost</span>
            <span>— School Web Hosting Project</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-[#15803D] transition">Documentation</a>
            <a href="#" className="hover:text-[#15803D] transition">Status</a>
            <a href="#" className="hover:text-[#15803D] transition">Support</a>
          </div>
        </div>
      </div>
    </footer>
  );
}