import React from 'react';

type Props = {
  pdfUrl: string;
};

const PDFViewer = ({ pdfUrl }: Props) => {
  // We use Google's free document viewer to easily embed the Supabase public URL inside an iframe
  return (
    <iframe
      src={`https://docs.google.com/gview?url=${pdfUrl}&embedded=true`}
      className="w-full h-full rounded-lg"
    ></iframe>
  );
};

export default PDFViewer;