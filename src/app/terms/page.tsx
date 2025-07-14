"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              Terms and Conditions for Recording of Doctor-Patient Conversations
            </CardTitle>
            <p className="text-center text-gray-600 mt-2">
              By using the AiDA application, you acknowledge and agree to the following terms regarding the recording and processing of conversations between doctors and patients:
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-2">1. Purpose of Recording</h3>
              <p className="text-gray-700">
                AiDA records audio conversations solely to provide transcription, diagnostic suggestions, and documentation support. The recordings are used to improve patient care, reduce administrative burden for healthcare professionals, and enhance clinical decision-making.
              </p>
            </div>

            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-2">2. Consent</h3>
              <p className="text-gray-700 mb-2">By logging into and using this application:</p>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Doctors confirm that they have obtained informed consent from the patient prior to recording any conversation.</li>
                <li>Patients should be clearly informed that the consultation will be recorded and transcribed, and that the data will be used strictly for medical support and documentation.</li>
              </ul>
            </div>

            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-2">3. Data Privacy</h3>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>All audio recordings, transcriptions, and related data are stored securely using industry-standard encryption.</li>
                <li>Access to data is restricted to authorized medical professionals and system administrators for support and maintenance.</li>
                <li>Data will not be shared with third parties without explicit consent, except where required by law.</li>
              </ul>
            </div>

            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-2">4. Usage of Transcriptions and Diagnoses</h3>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>AiDA provides AI-generated transcriptions, follow-up questions, and diagnostic suggestions as decision-support tools.</li>
                <li>These outputs are not a substitute for clinical judgment, and final diagnosis and treatment decisions rest solely with the attending healthcare professional.</li>
              </ul>
            </div>

            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-2">5. Retention and Deletion</h3>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>Data will be retained according to your organization's medical data retention policy, or as defined in applicable healthcare regulations.</li>
                <li>Users may request deletion of specific patient records by contacting the system administrator or support team, subject to compliance requirements.</li>
              </ul>
            </div>

            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-2">6. Legal Compliance</h3>
              <ul className="list-disc pl-6 space-y-1 text-gray-700">
                <li>The application is intended for use by state-registered doctors and licensed healthcare providers.</li>
                <li>Users must comply with applicable laws and medical regulations, including (but not limited to) patient privacy, consent, and data handling laws in their jurisdiction (e.g., HIPAA, GDPR, PDPA).</li>
              </ul>
            </div>

            <div className="border-b pb-4">
              <h3 className="font-semibold text-lg mb-2">7. Modification of Terms</h3>
              <p className="text-gray-700">
                AiDA reserves the right to modify these terms at any time. Updated terms will be posted within the application and continued use signifies acceptance.
              </p>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="font-semibold text-center text-blue-800">
                By logging in, you confirm that you have read and agree to the above Terms and Conditions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}