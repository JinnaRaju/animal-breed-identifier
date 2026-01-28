
import React, { useState, useEffect, useRef } from 'react';
import { User, BreedResult, HealthAnalysisResponse } from '../types';
import { 
  identifyBreed, 
  getBreedFacts, 
  generateBreedAudio, 
  decodeBase64, 
  decodeAudioData,
  generateSimilarBreedImage,
  detectAnimalDiseases
} from '../services/geminiService';
import { db } from '../services/db';

interface DashboardProps {
  user: User;
}

const Dashboard: React.FC<DashboardProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'id' | 'shop'>('id');
  const [isUploading, setIsUploading] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isFetchingFacts, setIsFetchingFacts] = useState(false);
  const [isAnalyzingHealth, setIsAnalyzingHealth] = useState(false);
  const [loadingSimilarBreed, setLoadingSimilarBreed] = useState<string | null>(null);
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<BreedResult | null>(null);
  const [healthAnalysis, setHealthAnalysis] = useState<HealthAnalysisResponse | null>(null);
  const [funFacts, setFunFacts] = useState<{text: string, sources: any[]} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [similarBreedImages, setSimilarBreedImages] = useState<Record<string, string>>({});
  const [shoppingCart, setShoppingCart] = useState<BreedResult[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const loadPurchases = async () => {
      const scans = await db.getUserScans(user.id);
      setShoppingCart(scans.filter(s => s.isPurchased));
    };
    loadPurchases();
    return () => { if (audioContextRef.current) audioContextRef.current.close(); };
  }, [user.id]);

  const saveScanToDB = async (result: BreedResult) => {
    try {
      await db.saveScan(result);
    } catch (err) {
      console.error("Failed to save scan", err);
    }
  };

  const handleIdentify = async () => {
    if (!selectedImage) return;
    setIsUploading(true);
    setError(null);
    setCurrentResult(null);
    setFunFacts(null);
    setHealthAnalysis(null);
    setSimilarBreedImages({});

    try {
      const prediction = await identifyBreed(selectedImage);
      const newResult: BreedResult = {
        ...prediction,
        id: Math.random().toString(36).substr(2, 9),
        userId: user.id,
        imageUrl: selectedImage,
        timestamp: new Date().toISOString()
      };
      setCurrentResult(newResult);
      await saveScanToDB(newResult);
    } catch (err: any) {
      setError(err.message || "Identification failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleVisualizeBreed = async (breed: string) => {
    if (similarBreedImages[breed]) return;
    setLoadingSimilarBreed(breed);
    try {
      const url = await generateSimilarBreedImage(breed);
      setSimilarBreedImages(prev => ({ ...prev, [breed]: url }));
    } catch (err) {
      console.error("Failed to visualize breed", err);
    } finally {
      setLoadingSimilarBreed(null);
    }
  };

  const handlePurchase = async () => {
    if (!currentResult) return;
    const purchased = { ...currentResult, isPurchased: true };
    await saveScanToDB(purchased);
    setShoppingCart(prev => [purchased, ...prev]);
    setCurrentResult(purchased);
    alert(`Success! ${currentResult.breedName} has been added to your collection.`);
  };

  const handleReturn = async (id: string) => {
    if (window.confirm("Return this animal for a full refund?")) {
      await db.deleteScan(id);
      setShoppingCart(prev => prev.filter(s => s.id !== id));
      if (currentResult?.id === id) setCurrentResult(prev => prev ? { ...prev, isPurchased: false } : null);
    }
  };

  const handleExchange = (breed: string) => {
    alert(`Exchange request initiated for ${breed}. An advisor will contact you soon.`);
  };

  const handleListen = async () => {
    if (!currentResult || isPlayingAudio) return;
    setIsPlayingAudio(true);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const voiceText = `This is a ${currentResult.breedName}. ${currentResult.description}. In terms of care, it requires a diet of ${currentResult.dietRoutine} and follows an exercise plan of ${currentResult.exercisePlan}. It has a life expectancy of ${currentResult.lifeExpectancy}.`;
      const base64 = await generateBreedAudio(voiceText);
      const buffer = await decodeAudioData(decodeBase64(base64), audioContextRef.current);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsPlayingAudio(false);
      source.start();
    } catch { 
      setIsPlayingAudio(false); 
    }
  };

  const handleHealthCheck = async () => {
    if (!selectedImage || !currentResult) return;
    setIsAnalyzingHealth(true);
    try {
      const analysis = await detectAnimalDiseases(selectedImage, currentResult.animalType);
      setHealthAnalysis(analysis);
      const updatedResult = { ...currentResult, healthAnalysis: analysis };
      setCurrentResult(updatedResult);
      await saveScanToDB(updatedResult);
    } catch { 
      setError("Health analysis failed."); 
    } finally { 
      setIsAnalyzingHealth(false); 
    }
  };

  const handleGetFacts = async () => {
    if (!currentResult) return;
    setIsFetchingFacts(true);
    try {
      const facts = await getBreedFacts(currentResult.breedName);
      setFunFacts(facts);
    } catch { 
      console.error("Facts fetch failed"); 
    } finally { 
      setIsFetchingFacts(false); 
    }
  };

  const resetAll = () => {
    setSelectedImage(null);
    setCurrentResult(null);
    setFunFacts(null);
    setHealthAnalysis(null);
    setSimilarBreedImages({});
    setError(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Navigation Tabs */}
      <div className="flex justify-center mb-12 bg-white/50 backdrop-blur-md p-1.5 rounded-3xl w-fit mx-auto border border-gray-100 shadow-xl">
        <button 
          onClick={() => setActiveTab('id')} 
          className={`flex items-center space-x-3 px-10 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'id' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' : 'text-gray-500 hover:bg-white hover:text-indigo-600'}`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <span>Discovery & Medical</span>
        </button>
        <button 
          onClick={() => setActiveTab('shop')} 
          className={`flex items-center space-x-3 px-10 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'shop' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105' : 'text-gray-500 hover:bg-white hover:text-indigo-600'}`}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          <span>Marketplace</span>
        </button>
      </div>

      {activeTab === 'id' ? (
        <div className="space-y-12 animate-fade-in">
          {/* Main Content Section */}
          <section className="bg-white rounded-[3rem] shadow-2xl border border-gray-100 overflow-hidden relative">
            <div className="p-8 md:p-12">
              {!selectedImage ? (
                <div className="border-4 border-dashed border-indigo-50 bg-indigo-50/10 rounded-[2.5rem] p-32 text-center hover:border-indigo-400 transition-all cursor-pointer group relative overflow-hidden">
                  <input type="file" accept="image/*" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => setSelectedImage(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
                  <div className="space-y-6 relative z-10">
                    <div className="mx-auto w-28 h-28 bg-white text-indigo-600 rounded-[2rem] flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform duration-500">
                      <svg className="h-14 w-14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <p className="text-4xl font-black text-gray-900 tracking-tighter">Start Discovery Scan</p>
                      <p className="text-gray-500 mt-4 text-lg font-medium">Capture or upload an animal photo for deep AI analysis.</p>
                    </div>
                  </div>
                  <div className="absolute top-0 right-0 -mr-20 -mt-20 h-64 w-64 bg-indigo-100/30 rounded-full blur-3xl"></div>
                </div>
              ) : (
                <div className="space-y-16">
                  {/* Hero Image and Summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl bg-gray-900 aspect-square flex items-center justify-center">
                      <img src={selectedImage} alt="Selected" className="h-full w-full object-cover" />
                      <button onClick={resetAll} className="absolute top-8 right-8 bg-black/40 backdrop-blur-xl text-white p-4 rounded-full hover:bg-red-600 transition-all shadow-2xl"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>

                    {!currentResult ? (
                      <div className="space-y-8">
                        <div className="space-y-4">
                           <h2 className="text-5xl font-black text-gray-900 leading-none tracking-tighter">Ready for AI Analysis</h2>
                           <p className="text-xl text-gray-500 font-medium">We'll identify the breed, calculate market value, and generate a medical care routine.</p>
                        </div>
                        <button onClick={handleIdentify} disabled={isUploading} className="w-full py-8 bg-indigo-600 text-white font-black rounded-3xl hover:bg-indigo-700 shadow-[0_20px_50px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50 text-2xl flex items-center justify-center space-x-4 group">
                          {isUploading ? <><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div><span>Processing Neural Networks...</span></> : <><svg className="h-8 w-8 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg><span>Launch Identification Scan</span></>}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-10 animate-fade-in">
                        <div className="space-y-4">
                          <div className="flex items-center space-x-3">
                            <span className="px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest">{currentResult.animalType}</span>
                            <span className="px-4 py-1.5 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest">Market Value: ${currentResult.price.toLocaleString()}</span>
                          </div>
                          <h2 className="text-6xl font-black text-gray-900 tracking-tighter leading-none">{currentResult.breedName}</h2>
                        </div>
                        
                        {/* Breed Description Section with Voice */}
                        <div className="bg-gray-50 p-10 rounded-[2.5rem] border border-gray-100 relative group">
                           <div className="flex justify-between items-start mb-6">
                              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">AI Breed Profile</h3>
                              <button onClick={handleListen} disabled={isPlayingAudio} className={`flex items-center space-x-2 px-6 py-2.5 rounded-2xl text-xs font-black transition-all ${isPlayingAudio ? 'bg-indigo-600 text-white animate-pulse' : 'bg-white text-indigo-600 shadow-xl shadow-indigo-100 hover:bg-indigo-50'}`}>
                                 <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828a1 1 0 010-1.415z" clipRule="evenodd" /></svg>
                                 <span>{isPlayingAudio ? "AI Speaking..." : "Listen to Profile"}</span>
                              </button>
                           </div>
                           <p className="text-xl text-gray-700 leading-relaxed font-medium italic">"{currentResult.description}"</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                           <div className="bg-white border-2 border-gray-100 p-8 rounded-[2rem] shadow-sm">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Life Expectancy</p>
                              <p className="text-3xl font-black text-gray-900">{currentResult.lifeExpectancy}</p>
                           </div>
                           <div className="bg-white border-2 border-gray-100 p-8 rounded-[2rem] shadow-sm">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Confidence Score</p>
                              <p className="text-3xl font-black text-indigo-600">{currentResult.confidence}%</p>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {currentResult && (
                    <div className="space-y-20 animate-fade-in pt-12 border-t border-gray-100">
                      
                      {/* Medical & Diagnostic Section */}
                      <section className="space-y-10">
                         <div className="flex items-end justify-between">
                            <div className="space-y-2">
                               <h3 className="text-4xl font-black text-gray-900 tracking-tighter">Medical Diagnostic Hub</h3>
                               <p className="text-gray-500 font-medium">Complete visual tissue scan and tailored health routines.</p>
                            </div>
                            {!healthAnalysis && (
                               <button onClick={handleHealthCheck} disabled={isAnalyzingHealth} className="px-12 py-5 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 shadow-2xl transition-all transform hover:-translate-y-1">
                                  {isAnalyzingHealth ? "Running Diagnostics..." : "Start Health Scan"}
                               </button>
                            )}
                         </div>

                         {healthAnalysis && (
                           <div className="space-y-10 animate-fade-in">
                              <div className={`p-8 rounded-[2.5rem] flex items-center space-x-6 border-2 ${healthAnalysis.isHealthy ? 'bg-green-50 border-green-100 text-green-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                                 <div className={`p-5 rounded-[1.5rem] ${healthAnalysis.isHealthy ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'}`}>
                                    <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                                 </div>
                                 <div>
                                    <h4 className="text-2xl font-black uppercase tracking-tight">{healthAnalysis.isHealthy ? "Optimal Health Verified" : "Anomalies Detected"}</h4>
                                    <p className="text-lg opacity-80 font-medium">{healthAnalysis.summary}</p>
                                 </div>
                              </div>

                              {healthAnalysis.potentialIssues.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                   {healthAnalysis.potentialIssues.map((issue, idx) => (
                                      <div key={idx} className="bg-white p-10 rounded-[3rem] border border-red-50 shadow-2xl relative overflow-hidden group hover:border-red-200 transition-all">
                                         <div className={`absolute top-0 right-0 px-8 py-3 rounded-bl-[2rem] text-[10px] font-black uppercase tracking-widest ${issue.severity === 'High' ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white'}`}>
                                            {issue.severity} Priority
                                         </div>
                                         <h5 className="text-2xl font-black text-gray-900 mb-4">{issue.issue}</h5>
                                         <p className="text-gray-600 mb-8 font-medium leading-relaxed">{issue.description}</p>
                                         <div className="p-6 bg-red-50/50 rounded-2xl border border-red-100">
                                            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2">Professional Advice</p>
                                            <p className="text-gray-900 font-bold italic">"{issue.recommendedAction}"</p>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                              )}
                           </div>
                         )}

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="bg-white border-2 border-gray-50 p-10 rounded-[3rem] shadow-xl hover:shadow-2xl transition-all">
                               <h4 className="text-xl font-black text-gray-900 mb-6 flex items-center">
                                  <div className="p-3 bg-green-100 text-green-600 rounded-2xl mr-4"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg></div>
                                  Ecosystem Diet Plan
                               </h4>
                               <p className="text-gray-600 leading-relaxed font-medium italic bg-gray-50/50 p-6 rounded-2xl border border-gray-100 whitespace-pre-line">{currentResult.dietRoutine}</p>
                            </div>
                            <div className="bg-white border-2 border-gray-50 p-10 rounded-[3rem] shadow-xl hover:shadow-2xl transition-all">
                               <h4 className="text-xl font-black text-gray-900 mb-6 flex items-center">
                                  <div className="p-3 bg-orange-100 text-orange-600 rounded-2xl mr-4"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></div>
                                  Exercise & Activity Plan
                               </h4>
                               <p className="text-gray-600 leading-relaxed font-medium italic bg-gray-50/50 p-6 rounded-2xl border border-gray-100 whitespace-pre-line">{currentResult.exercisePlan}</p>
                            </div>
                         </div>
                      </section>

                      {/* Similar Breeds Section */}
                      <section className="space-y-10">
                         <div className="flex items-center justify-between">
                            <h3 className="text-4xl font-black text-gray-900 tracking-tighter">Genetic Relatives</h3>
                            <button onClick={handleGetFacts} className="px-8 py-3 bg-indigo-50 text-indigo-600 font-black rounded-xl hover:bg-indigo-100 transition-all text-xs uppercase tracking-widest">Ground Facts</button>
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
                            {currentResult.similarBreeds.map((breed) => (
                               <div key={breed} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden group hover:-translate-y-4 transition-all duration-500 hover:shadow-indigo-100">
                                  <div className="h-64 bg-gray-900 relative flex items-center justify-center">
                                     {similarBreedImages[breed] ? (
                                        <img src={similarBreedImages[breed]} alt={breed} className="w-full h-full object-cover opacity-90 group-hover:scale-110 transition-transform duration-1000" />
                                     ) : (
                                        <div className="text-center p-8">
                                           <button 
                                             onClick={() => handleVisualizeBreed(breed)}
                                             disabled={loadingSimilarBreed === breed}
                                             className="px-8 py-4 bg-indigo-600 text-white text-xs font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-xl"
                                           >
                                              {loadingSimilarBreed === breed ? "Visualizing..." : "AI Visual Preview"}
                                           </button>
                                        </div>
                                     )}
                                     <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                     <p className="absolute bottom-6 left-8 text-white font-black text-2xl tracking-tighter">{breed}</p>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </section>

                      {/* Marketplace CTA Section */}
                      <div className="flex flex-col md:flex-row gap-6">
                        {!currentResult.isPurchased ? (
                           <button onClick={handlePurchase} className="flex-grow py-10 bg-green-600 text-white text-2xl font-black rounded-[2.5rem] hover:bg-green-700 shadow-3xl shadow-green-100 transition-all transform hover:-translate-y-2 flex items-center justify-center space-x-6 px-12">
                              <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                              <span>Acquire to Ecosystem • ${currentResult.price.toLocaleString()}</span>
                           </button>
                        ) : (
                           <div className="flex-grow py-10 bg-indigo-50 border-4 border-indigo-100 text-indigo-700 font-black rounded-[2.5rem] flex items-center justify-center space-x-6">
                              <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                              <span className="text-3xl tracking-tighter uppercase">Secured Ownership</span>
                           </div>
                        )}
                        <button onClick={resetAll} className="px-12 py-10 border-4 border-gray-100 text-gray-400 font-black text-xs uppercase tracking-[0.3em] rounded-[2.5rem] hover:bg-gray-50 transition-all">New Discovery</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        /* Marketplace Tab Module */
        <div className="space-y-16 animate-fade-in">
           <div className="text-center space-y-4">
              <h2 className="text-6xl font-black text-gray-900 tracking-tighter">My Ecosystem Marketplace</h2>
              <p className="text-xl text-gray-500 font-medium">Full ownership rights management, exchanges, and return protocols.</p>
           </div>

           {shoppingCart.length === 0 ? (
              <div className="bg-white rounded-[4rem] p-40 text-center border-2 border-dashed border-gray-100 shadow-2xl flex flex-col items-center group">
                 <div className="h-32 w-32 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center text-indigo-300 mb-10 transition-transform group-hover:scale-110"><svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg></div>
                 <p className="font-black text-gray-400 uppercase tracking-[0.5em] text-sm">Marketplace Portfolio Empty</p>
                 <button onClick={() => setActiveTab('id')} className="mt-12 px-16 py-6 bg-indigo-600 text-white font-black rounded-3xl shadow-3xl hover:bg-indigo-700 transition-all text-lg">Acquire Your First Asset</button>
              </div>
           ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                 {shoppingCart.map((item) => (
                    <div key={item.id} className="bg-white rounded-[3.5rem] overflow-hidden shadow-2xl border border-gray-100 flex flex-col group hover:-translate-y-4 transition-all duration-700 hover:shadow-indigo-100/50">
                       <div className="h-72 relative bg-gray-900 overflow-hidden">
                          <img src={item.imageUrl} alt={item.breedName} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.5s] opacity-90" />
                          <div className="absolute top-8 left-8 bg-white/95 backdrop-blur shadow-2xl px-6 py-2.5 rounded-full text-[10px] font-black text-indigo-600 uppercase tracking-widest border border-white/50">Asset Secured</div>
                          <div className="absolute bottom-8 right-8 bg-green-600 text-white px-8 py-3 rounded-3xl text-sm font-black shadow-3xl ring-[12px] ring-white/10 tracking-tight">${item.price.toLocaleString()}</div>
                       </div>
                       <div className="p-10 flex-grow">
                          <h3 className="font-black text-gray-900 text-3xl mb-3 tracking-tighter">{item.breedName}</h3>
                          <p className="text-[12px] text-gray-400 font-black uppercase mb-10 tracking-[0.2em]">{item.animalType} • {item.lifeExpectancy} longevity</p>
                          
                          <div className="grid grid-cols-2 gap-6 mb-10">
                             <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 text-center">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                                <p className="text-sm font-black text-indigo-600">Active Monitoring</p>
                             </div>
                             <div className="p-5 bg-gray-50 rounded-3xl border border-gray-100 text-center">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Asset Key</p>
                                <p className="text-sm font-black text-gray-900">#{item.id.toUpperCase()}</p>
                             </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                             {item.uses.map(u => <span key={u} className="px-4 py-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-xl uppercase tracking-tighter">{u}</span>)}
                          </div>
                       </div>
                       <div className="p-8 bg-gray-50/50 border-t border-gray-100 grid grid-cols-2 gap-6">
                          <button onClick={() => handleExchange(item.breedName)} className="py-5 bg-white text-gray-800 text-[10px] font-black rounded-2xl border border-gray-200 hover:bg-gray-100 transition-all uppercase tracking-widest shadow-sm">Sync Exchange</button>
                          <button onClick={() => handleReturn(item.id)} className="py-5 bg-white text-red-600 text-[10px] font-black rounded-2xl border border-red-100 hover:bg-red-50 transition-all uppercase tracking-widest shadow-sm">Liquidate</button>
                       </div>
                    </div>
                 ))}
              </div>
           )}

           <div className="bg-gradient-to-br from-indigo-950 to-black text-white p-20 rounded-[4rem] shadow-3xl relative overflow-hidden">
              <div className="relative z-10 flex flex-col xl:flex-row items-center justify-between gap-16">
                 <div className="max-w-3xl text-center xl:text-left space-y-8">
                    <h3 className="text-5xl font-black leading-none tracking-tighter">Ultimate Ownership Protocols</h3>
                    <p className="text-indigo-200 leading-relaxed font-medium text-xl">Every acquisition includes lifetime AI medical updates, real-time market value indexing, and prioritized genetic swap windows. Your pet ecosystem is managed with architectural precision.</p>
                 </div>
                 <div className="flex flex-wrap justify-center gap-10">
                    <div className="p-10 bg-white/5 backdrop-blur-3xl rounded-[3rem] text-center border border-white/10 w-48 transition-transform hover:scale-105">
                       <p className="text-5xl font-black mb-1">0%</p>
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Buyback Fee</p>
                    </div>
                    <div className="p-10 bg-indigo-600/30 backdrop-blur-3xl rounded-[3rem] text-center border border-white/10 w-48 transition-transform hover:scale-105">
                       <p className="text-5xl font-black mb-1">24h</p>
                       <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Swap Portal</p>
                    </div>
                 </div>
              </div>
              <div className="absolute top-0 right-0 -mr-64 -mt-64 h-[600px] w-[600px] bg-indigo-500/10 rounded-full blur-[150px]"></div>
              <div className="absolute bottom-0 left-0 -ml-64 -mb-64 h-[600px] w-[600px] bg-indigo-800/30 rounded-full blur-[150px]"></div>
           </div>
        </div>
      )}

      <style>{`
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        .shadow-3xl { shadow: 0 35px 60px -15px rgba(0, 0, 0, 0.3); }
      `}</style>
    </div>
  );
};

export default Dashboard;
