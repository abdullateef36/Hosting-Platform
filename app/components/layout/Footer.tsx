export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        <div className="flex flex-col md:flex-row md:justify-between md:items-center text-sm text-gray-600 gap-4">
          
          {/* Left Section */}
          <div className="flex flex-col items-center md:flex-row md:items-center gap-1 text-center md:text-left">
            <span>© {new Date().getFullYear()}</span>
            <span className="font-semibold text-[#15803D] md:ml-1">StudentHost</span>
            <span className="hidden md:inline">— School Web Hosting Project</span>
            <span className="md:hidden">School Web Hosting Project</span>
          </div>

          {/* Right Section */}
          <div className="flex gap-4 sm:gap-6 justify-center">
            <a href="#" className="hover:text-[#15803D] transition">Documentation</a>
            <a href="#" className="hover:text-[#15803D] transition">Status</a>
            <a href="#" className="hover:text-[#15803D] transition">Support</a>
          </div>

        </div>
      </div>
    </footer>
  );
}
