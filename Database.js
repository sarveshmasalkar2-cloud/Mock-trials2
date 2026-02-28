// Database.js
window.WitnessRoles = {
    "Dr. Rowan Hightower": { side: "plaintiff", title: "Structural Engineer" },
    "Reed Alvarez":         { side: "plaintiff", title: "HOA President" },
    "Dr. Ellis Chen":       { side: "plaintiff", title: "Engineering Professor" },
    "Cam Martinez":         { side: "defense",   title: "Project Manager, Metro Builders" },
    "Whitley Carter":       { side: "defense",   title: "Retired City Inspector" },
    "Ash Forrester":        { side: "defense",   title: "Structural Engineer" }
};

window.MockTrialCaseData = {
  "witnesses": {
    "Samuel Greene it is my professional opinion that the tower in its current state": [
      "possesses a critical and unacceptable structural vulnerability. This vulnerability stems directly",
      "from negligent design decisions by Apex Structural Engineering, Inc. and substandard",
      "construction practices by Metro Builders, LLC. The modifications made to the tower's",
      "\"elevated column\" design—specifically the substitution of welded joints with bolted",
      "connections—significantly compromises the building's ability to withstand quartering wind",
      "loads, a common and predictable environmental force. Without immediate and",
      "comprehensive structural retrofitting, the tower presents a clear and present danger to its",
      "occupants and the surrounding community.",
      "Background and Scope of Analysis",
      "The East Superior Residential Tower, a 30-story high-rise, located at 109 Summit Hill Drive,",
      "was designed by Apex Structural Engineering, Inc. and constructed by Metro Builders, LLC.",
      "The building features a unique architectural design incorporating \"elevated columns\" that are",
      "critical to its structural stability. The primary focus of this analysis is the integrity of the",
      "welded connections within this design, as they are the points of failure identified in",
      "independent wind load research.​",
      "This analysis is based on the following documents and findings:",
      "a.​ Original Design Specifications: Review of the initial plans by Apex Structural",
      "Engineering, Inc., which specified robust, welded joints for all critical structural",
      "connections.",
      "b.​ Whistleblower Memo: The leaked internal calculations and affidavit of Samuel Greene,",
      "a former engineer at Apex, confirming that Apex intentionally deviated from the initial",
      "design and approved a cost-saving substitution of bolted connections.",
      "c.​ Construction Records: Examination of the construction logs and materials from Metro",
      "Builders, LLC, which confirmed that the welded joints were substituted with bolted",
      "shear connections in the field, deviating from standard engineering best practices.",
      "d.​ Independent Wind Load Research: The findings of the Ph.D. student whose research",
      "first highlighted the critical vulnerability of the elevated column design under",
      "quartering wind loads."
    ],
    "Affidavit of Reed Alvarez": [
        "My name is Reed Alvarez. I am President of the East Superior Residential Homeowners Association (HOA), a position I have held since the building was completed and residents began moving in back in August 2014.",
        "I am testifying in this matter as a representative of the residents and owners affected by poor decisions made by the engineers and construction company.",
        "I am 71 years old and a retired attorney. I earned my Juris Doctor from the University of Miami School of Law.",
        "In March of 2016, I received a whistleblower memo, marked as Exhibit #1, from a concerned engineer that worked for Apex.",
        "Around the same time that I received the whistleblower’s memo, I got a call from Dr. Chen, an engineering professor who told me a Ph.D. student had the same concerns as the whistleblower.",
        "I can tell you that this information made my blood boil. I was on the telephone to the Apex engineers who designed the building demanding a meeting.",
        "Under my leadership, I was able to convince a majority of the owners that the building needed to be fixed immediately. The HOA members voted 51% to 49% to initiate emergency retrofits.",
        "The emotional toll on residents was and continues to be profound. Some residents have complained to me of sleepless nights, anxiety, and a loss of trust in the building’s safety.",
        "The HOA incurred substantial costs related to the retrofits and temporary relocations. These included: the emergency structural retrofitting cost of $22.6 million."
    ],
    "Affidavit of Dr. Ellis Chen": [
        "My name is Dr. Ellis Chen, and I am a tenured Professor of Civil and Environmental Engineering at Columbia University, specializing in wind engineering and aerodynamic modeling.",
        "My academic work focuses on wind tunnel testing, computational fluid dynamics (CFD), and the interaction between wind forces and tall structures.",
        "I became involved in the East Superior Residential Tower matter through my capacity as a faculty advisor to the Ph.D. student who first identified potential vulnerabilities in the building’s response to quartering wind loads.",
        "Quartering winds—those that strike a building at an oblique angle—can produce complex and elevated pressure distributions across multiple faces of a structure.",
        "My lab’s wind tunnel tests confirmed that the East Superior Residential Tower’s design, particularly its elevated column structure and narrow profile, made it susceptible to vortex shedding and resonance under quartering wind conditions.",
        "We felt it was vital to inform someone of our findings so we contacted Reed Alvarez, East Superior Residential Tower’s Homeowners Association (HOA) President.",
        "Apex Engineering’s failure to conduct either a wind tunnel test or CFD analysis specifically for quartering winds represents a deviation from the expected standard of care."
    ],
    "Affidavit of Dr. Rowan Hightower": [
        "My name is Dr. Rowan Hightower, and I am a licensed Professional Engineer (PE) in multiple states, including Michigan, and a certified industrial safety consultant with over 25 years of experience.",
        "I hold a Ph.D. in Structural Engineering from the Massachusetts Institute of Technology (MIT) and a Ph.D. in Industrial Hygiene and Risk Management from Johns Hopkins University.",
        "I became involved in the East Superior Residential Tower litigation after a colleague, Dr. Ellis Chen, contacted me in early February, 2016.",
        "I also received a copy of the whistleblower memo, marked as Exhibit #1. Upon reviewing calculations brought forward by the architectural student at Columbia University, I independently verified the presence of a dangerous resonance effect.",
        "First, the architectural design created a unique aerodynamic profile vulnerable to quartering winds.",
        "Third, Apex Engineering’s substitution of bolted shear connections for the stronger and more rigid welded joints significantly reduced lateral stiffness.",
        "In my professional opinion, the structural deficiencies identified in the East Superior Residential Tower were the direct result of negligent design decisions and cutting corners to save on costs."
    ],
    "Affidavit of Cam Martinez": [
        "My name is Cam Martinez, I am 41 years old. I was born and raised in Charleston, Michigan.",
        "I am the lead project manager for Metro Builders, a commercial construction firm specializing in high-rise residential and mixed-use developments.",
        "I served as the lead project manager for the East Superior Residential Tower construction project located at 109 Summit Hill Drive.",
        "Throughout construction, Metro Builders followed the approved engineering plans and specifications without deviation.",
        "One significant, but approved, modification was the use of bolted shear connections instead of welded moment connections in the structural framework.",
        "Following Metro’s completion of the structural framework, the City of East Superior performed a detailed inspection of the steel skeleton, including the bolted shear connections.",
        "Metro Builders fulfilled its contractual obligations fully and without defect. Our role was to execute construction in accordance with the approved plans provided by Apex Engineering.",
        "In my professional opinion, the East Superior Residential Tower was delivered to its owners as a safe, well-constructed, and fully code compliant building."
    ],
    "Affidavit of Whitley Carter": [
        "My name is Whitley Carter. I am a retired City Building Inspector with over 15 years of dedicated service in the field of commercial and residential construction oversight.",
        "I transitioned into inspection work after realizing how vital strong oversight is in ensuring the safety and integrity of the structures our communities depend on.",
        "As the city inspector for the East Superior Tower, I was responsible for reviewing structural drawings, conducting staged inspections during critical phases, and verifying full compliance with both the IBC and local regulations.",
        "Throughout all of these stages, I found no violations or structural deficiencies. Not one.",
        "When the project concluded, I signed off on the final inspection and approved the issuance of the CO—an official confirmation that the structure was safe, habitable, fully compliant with all governing codes.",
        "Let me be clear: the role of a building inspector is not to test every theoretical or speculative engineering model. Our responsibility is to ensure compliance with established, codified standards.",
        "In conclusion, and based on my direct involvement, I affirm that the East Superior Residential Tower was safe, structurally sound, and fully compliant with all relevant codes and ordinances at the time of inspection and approval."
    ],
    "Affidavit of Dr. Ash Forrester": [
        "My name is Dr. Ash Forrester. I am a licensed structural engineer with over 30 years of experience, primarily focused on the design, assessment, and forensic evaluation of high-rise structures.",
        "I have worked with Apex Engineering on numerous occasions over the past 15 years.",
        "Based on my review of the design calculations, wind load analyses, and structural drawings for the East Superior Residential Tower, it is my professional opinion that the building, as originally constructed, met all applicable codes and standards.",
        "Regarding wind loading: While quartering winds can introduce complex pressure patterns on a structure, the applied design loads for the East Superior Residential Tower remained within code-specified limits.",
        "As to the use of bolted shear connections in lieu of welded moment connections, this was a valid engineering decision.",
        "I have reviewed the Executive Summary authored under Dr. Ellis Chen’s supervision, which is Exhibit #2. I found the document deeply concerning, both in its tone and methodology.",
        "In my professional judgment, the retrofit measures undertaken by the East Superior Residential Homeowners Association (HOA) were unnecessary and driven more by optics and public anxiety than by any identifiable structural deficiencies."
    ]
  },
  "exhibits": {
    "Exhibit 1 Whistleblower Memo": ["Confidential Internal Memorandum", "From: Samuel Greene, P.E.", "Subject: Structural Safety Concerns – East Superior Residential Tower"],
    "Exhibit 2 Executive Summary": ["Executive Summary", "Potential Wind Dangers to a 30-Story High-Rise: The Case of Quartering Winds"],
    "Exhibit 3 Curriculum Vitae of Dr. Hightower": ["Curriculum Vitae", "Dr. Rowan Hightower, P.E."],
    "Exhibit 4 Report of Dr. Hightower": ["Report on Structural Integrity of East Superior Residential Tower", "From: Dr. Rowan Hightower, Ph.D, P.E."],
    "Exhibit 5 Curriculum Vitae of Dr. Forrester": ["Dr. Ash Forrester, Structural Engineering Expert"],
    "Exhibit 6 Report of Dr. Forrester": ["Defense Expert Engineering Report", "Prepared by: Dr. Ash Forrester, Ph.D., P.E."],
    "Exhibit 7 Final Inspection Report": ["City of East Superior Department of Building Inspections", "Final Inspection Report & Certificate of Occupancy"],
    "Exhibit 8 HOA Minutes": ["Emergency Meeting: Called by the Board of Directors", "Date: March 14, 2016"],
    "Exhibit 9 Lease Cancellation": ["Lease Cancellation Notice", "Date: March 29, 2016", "To: Reed Alvarez"],
    "Exhibit 10 Structural Retrofit Invoice": ["Structural Retrofit Invoice", "Client/Project: East Superior Residential HOA"],
    "Exhibit 11 Retrofit Inspection Report": ["Retrofit Inspection Report", "City of East Superior– Building Safety Division"],
    "Exhibit 14 News Articles": ["Local Skyscraper Faces Structural Crisis, Lawsuit Filed", "Residents Fear for Their Safety as Legal Battle Escalates"]
  }
};

window.MockTrialRulesData = [
  { 
    "rule": "802", 
    "name": "Hearsay", 
    "desc": "Hearsay is not admissible except as provided by these Rules.",
    "tip": "Ask yourself: Is the statement being offered for the truth of the matter asserted? If it's just to show the statement was made, it's not hearsay.",
    "pitfall": "Don't object if the declarant is the opposing party (Rule 801(d)(2))."
  },
  { 
    "rule": "403", 
    "name": "Prejudicial / Waste of Time", 
    "desc": "The probative value is substantially outweighed by unfair prejudice.",
    "tip": "Argue that the evidence inflames the jury's emotions without adding factual value.",
    "pitfall": "All evidence is prejudicial; you must prove it is *unfairly* prejudicial."
  },
  { 
    "rule": "602", 
    "name": "Lack of Personal Knowledge", 
    "desc": "A witness may not testify to a matter unless evidence is introduced sufficient to support a finding that the witness has personal knowledge of the matter.",
    "tip": "Listen for 'I believe', 'I assume', or 'I heard'.",
    "pitfall": "Experts (Rule 703) do not need personal knowledge if they rely on data reasonably relied upon by experts."
  },
  { 
    "rule": "404", 
    "name": "Improper Character Evidence", 
    "desc": "Evidence of a person's character or a trait of character is not admissible for the purpose of proving action in conformity therewith.",
    "tip": "Object when the other side uses past bad acts to say 'he did it before, so he did it again'.",
    "pitfall": "Character evidence IS admissible to prove motive, opportunity, intent, preparation, plan, knowledge, identity, or absence of mistake (MIMIC)."
  },
  { 
    "rule": "701", 
    "name": "Improper Lay Opinion", 
    "desc": "If the witness is not testifying as an expert, the witness' testimony in the form of opinions or inferences is limited.",
    "tip": "Lay witnesses can only talk about what they saw, heard, tasted, smelled, or felt.",
    "pitfall": "Lay witnesses CAN give opinions on speed, distance, and emotional state."
  },
  { 
    "rule": "401", 
    "name": "Relevancy", 
    "desc": "Relevant evidence means evidence having any tendency to make the existence of any fact that is of consequence to the determination of the action more probable or less probable.",
    "tip": "The bar for relevance is extremely low. If it helps a tiny bit, it's relevant.",
    "pitfall": "Don't confuse weight (how important it is) with admissibility (whether it comes in)."
  },
  { 
    "rule": "611", 
    "name": "Leading Question", 
    "desc": "Leading questions should not be used on direct examination of a witness except as may be necessary to develop the witness’ testimony.",
    "tip": "If the question suggests the answer (e.g., 'You went to the store, didn't you?'), it's leading.",
    "pitfall": "Leading is ALLOWED on Cross-Examination and with hostile witnesses."
  },
  { 
    "rule": "805", 
    "name": "Double Hearsay", 
    "desc": "Hearsay included within hearsay is not excluded under the hearsay rule if each part of the combined statement conforms with an exception to the hearsay rule.",
    "tip": "Break the chain. Is the first statement hearsay? Is the second? Both need exceptions.",
    "pitfall": "Business records often contain double hearsay (the record itself + the statement inside it)."
  },
  {
    "rule": "608",
    "name": "Evidence of Character and Conduct of Witness",
    "desc": "The credibility of a witness may be attacked or supported by evidence in the form of opinion or reputation, but subject to limitations.",
    "tip": "You can attack truthfulness, but you can't bolster it until it's been attacked.",
    "pitfall": "Specific instances of conduct are generally not admissible to prove truthfulness."
  },
  {
    "rule": "609",
    "name": "Impeachment by Evidence of a Criminal Conviction",
    "desc": "Evidence that a witness has been convicted of a crime shall be admitted if elicited from the witness or established by public record during cross-examination.",
    "tip": "Crimes involving dishonesty or false statement are always admissible.",
    "pitfall": "There's a 10-year time limit on convictions unless the court determines otherwise."
  },
  {
    "rule": "612",
    "name": "Writing Used to Refresh a Witness's Memory",
    "desc": "If a witness uses a writing to refresh memory for the purpose of testifying, an adverse party is entitled to have the writing produced.",
    "tip": "Use this when a witness says 'I don't recall'.",
    "pitfall": "Don't read the document into the record; just let the witness read it silently."
  },
  {
    "rule": "613",
    "name": "Prior Statements of Witnesses",
    "desc": "Examining a witness concerning a prior statement made by the witness, whether written or not.",
    "tip": "The classic impeachment tool. 'You said X today, but in your affidavit you said Y'.",
    "pitfall": "You must give the witness an opportunity to explain or deny the statement."
  },
  {
    "rule": "702",
    "name": "Testimony by Experts",
    "desc": "If scientific, technical, or other specialized knowledge will assist the trier of fact, a witness qualified as an expert may testify thereto in the form of an opinion.",
    "tip": "Qualify your expert first! Education, experience, training.",
    "pitfall": "Experts can't just say anything; it must be based on sufficient facts or data."
  },
  {
    "rule": "703",
    "name": "Bases of Opinion Testimony by Experts",
    "desc": "The facts or data in the particular case upon which an expert bases an opinion or inference may be those perceived by or made known to the expert at or before the hearing.",
    "tip": "Experts can rely on inadmissible evidence (like hearsay) if it's standard in their field.",
    "pitfall": "Don't let the expert just be a conduit for hearsay."
  },
  {
    "rule": "704",
    "name": "Opinion on Ultimate Issue",
    "desc": "Testimony in the form of an opinion or inference otherwise admissible is not objectionable because it embraces an ultimate issue to be decided by the trier of fact.",
    "tip": "Experts CAN say 'The defendant was negligent'.",
    "pitfall": "Exception: In criminal cases, experts can't state if the defendant had the mental state constituting the crime."
  },
  {
    "rule": "801",
    "name": "Definitions (Hearsay)",
    "desc": "Defines what is and isn't hearsay. Statements by party opponents are NOT hearsay.",
    "tip": "Anything the defendant said is admissible against them.",
    "pitfall": "Silence can be an admission/statement."
  },
  {
    "rule": "803",
    "name": "Hearsay Exceptions (Availability Immaterial)",
    "desc": "Exceptions like Present Sense Impression, Excited Utterance, Then Existing Mental State, Business Records.",
    "tip": "Excited Utterance: 'Oh my god, the car is crashing!'",
    "pitfall": "Business records must be kept in the regular course of business."
  },
  {
    "rule": "804",
    "name": "Hearsay Exceptions (Declarant Unavailable)",
    "desc": "Exceptions like Dying Declaration, Statement Against Interest.",
    "tip": "Dying Declaration: 'I'm dying... it was Bob who shot me.'",
    "pitfall": "The declarant must strictly be unavailable (dead, privilege, etc.)."
  }
];

// QuestionsDB.js
window.MockQuestionsDB = {
  "plaintiff": {
    "Dr. Rowan Hightower": {
      "direct": [
        { "q": "Please state your name for the record.", "type": "intro", "keywords": ["hightower", "my name is", "name is"] },
        { "q": "Can you describe your educational background for the court?", "type": "normal", "keywords": ["engineer", "licensed", "years", "degree"] },
        { "q": "What does Exhibit Number 3 — your curriculum vitae — show about your experience?", "type": "normal", "keywords": ["exhibit", "document", "report", "engineer", "licensed", "years", "degree"] },
        { "q": "Can you explain the difference between a welded moment connection and a bolted shear connection?", "type": "normal", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "Which connection type was specified in the original approved design?", "type": "normal", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "Which connection type was actually installed during construction?", "type": "hard", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "What effect does substituting bolted for welded connections have on lateral load capacity?", "type": "normal", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "Can you explain what quartering wind loads are in plain terms?", "type": "normal", "keywords": ["wind", "quartering", "lateral", "load"] },
        { "q": "What did your analysis find about the building's capacity under quartering wind loads?", "type": "normal", "keywords": ["wind", "quartering", "lateral", "load"] },
        { "q": "What is Exhibit Number 4, your engineering report, and what are its conclusions?", "type": "normal", "keywords": ["exhibit", "document", "report"] },
        { "q": "In your professional opinion, was the East Superior Residential Tower structurally safe as built?", "type": "exhibit", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Were the retrofits you recommended ultimately performed on the building?", "type": "normal", "keywords": ["retrofit", "repair", "reinforcement", "weld"] },
        { "q": "How did you verify the findings of the graduate student's model?", "type": "hard", "keywords": ["verify", "check", "model", "calculate"] },
        { "q": "Did you review the construction logs from Metro Builders?", "type": "normal", "keywords": ["log", "record", "construction", "review"] },
        { "q": "What did those logs reveal about the installation process?", "type": "normal", "keywords": ["install", "process", "change", "order"] },
        { "q": "OUTRO", "statement": "Thank you. No further questions." }
      ],
      "cross": [
        { "q": "Please state your name for the record.", "type": "intro", "keywords": ["hightower", "my name is", "name is"] },
        { "q": "Dr. Hightower, you are being compensated for your testimony today, correct?", "type": "exhibit", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Isn't it true that the East Superior Residential Tower is still standing today?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "You are aware that the building passed the city's structural inspection in 2014?", "type": "normal", "keywords": ["inspection", "code", "certificate", "passed"] },
        { "q": "Isn't it true that the building code in effect at the time of construction did not require quartering wind analysis?", "type": "normal", "keywords": ["wind", "quartering", "lateral", "load"] },
        { "q": "Your quartering wind analysis relies on a model developed by a graduate student, correct?", "type": "normal", "keywords": ["wind", "quartering", "lateral", "load"] },
        { "q": "Bolted shear connections are a recognized and code-compliant construction method, aren't they?", "type": "normal", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "You did not personally inspect the building during or after construction, did you?", "type": "hard", "keywords": ["inspection", "code", "certificate", "passed"] },
        { "q": "The retrofit was completed — so the building is now safe regardless of your earlier concerns?", "type": "normal", "keywords": ["retrofit", "repair", "reinforcement", "weld"] },
        { "q": "You have never worked on a project with Metro Builders before, have you?", "type": "normal", "keywords": ["metro", "builder", "project", "work"] },
        { "q": "Your expertise is primarily in industrial safety, not high-rise construction, isn't it?", "type": "hard", "keywords": ["safety", "industrial", "high-rise", "construction"] },
        { "q": "OUTRO", "statement": "That will be all. Thank you." }
      ]
    },
    "Reed Alvarez": {
      "direct": [
        { "q": "Please state your name for the record.", "type": "intro", "keywords": ["alvarez", "my name is", "name is"] },
        { "q": "What is your position with the East Superior Residential Tower?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "When did you first become aware of potential structural concerns with the tower?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Who first contacted you about the whistleblower memo?", "type": "normal", "keywords": ["memo", "whistleblower", "greene", "samuel"] },
        { "q": "How did you react when you learned about the structural concerns?", "type": "exhibit", "keywords": ["yes", "correct", "that is right"] },
        { "q": "What steps did you take after learning about the memo?", "type": "normal", "keywords": ["memo", "whistleblower", "greene", "samuel"] },
        { "q": "How did the HOA ultimately vote on the question of performing a retrofit?", "type": "normal", "keywords": ["retrofit", "repair", "reinforcement", "weld"] },
        { "q": "What were the financial consequences of the retrofit for unit owners?", "type": "normal", "keywords": ["retrofit", "repair", "reinforcement", "weld", "cost", "percent", "million", "savings"] },
        { "q": "Have property values in the building been affected by these events?", "type": "exhibit", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Did you communicate with Apex Engineering directly?", "type": "normal", "keywords": ["apex", "engineer", "contact", "call"] },
        { "q": "What was their response to your concerns?", "type": "normal", "keywords": ["response", "answer", "reply", "ignore"] },
        { "q": "OUTRO", "statement": "Nothing further. The record speaks for itself." }
      ],
      "cross": [
        { "q": "Please state your name for the record.", "type": "intro", "keywords": ["alvarez", "my name is", "name is"] },
        { "q": "Mr. Alvarez, you have no professional background in structural engineering, correct?", "type": "exhibit", "keywords": ["engineer", "licensed", "years", "degree"] },
        { "q": "You relied entirely on outside experts to form your views about the structural concerns?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Isn't it true the HOA vote to proceed with the retrofit was only fifty-one to forty-nine percent?", "type": "normal", "keywords": ["retrofit", "repair", "reinforcement", "weld"] },
        { "q": "Isn't it fair to say that you had already made up your mind before the HOA meeting?", "type": "exhibit", "keywords": ["yes", "correct", "that is right"] },
        { "q": "You went to the press with this story before giving the defendants an opportunity to respond?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "The building passed city inspection when it was constructed. You knew that at the time of the vote?", "type": "normal", "keywords": ["inspection", "code", "certificate", "passed"] },
        { "q": "You are currently suing Apex Engineering for damages, correct?", "type": "hard", "keywords": ["sue", "lawsuit", "damage", "money"] },
        { "q": "So you have a financial interest in the outcome of this trial?", "type": "hard", "keywords": ["financial", "interest", "money", "outcome"] },
        { "q": "OUTRO", "statement": "That will be all. Thank you." }
      ]
    },
    "Dr. Ellis Chen": {
      "direct": [
        { "q": "Please state your name for the record.", "type": "intro", "keywords": ["chen", "my name is", "name is"] },
        { "q": "Where are you currently employed?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "What subject area do you teach and research?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "What did your student's research reveal about the building's structural design?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "How did your student's analysis model the quartering wind scenario for this building?", "type": "exhibit", "keywords": ["wind", "quartering", "lateral", "load"] },
        { "q": "What did the modeling show about the capacity of the bolted connections under those loads?", "type": "normal", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "Do you believe the structural concerns identified in the research are valid?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "In your academic opinion, was the connection substitution consistent with sound structural engineering practice?", "type": "exhibit", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "OUTRO", "statement": "No further questions, your Honor." }
      ],
      "cross": [
        { "q": "Please state your name for the record.", "type": "intro", "keywords": ["chen", "my name is", "name is"] },
        { "q": "Dr. Chen, you are a professor of civil engineering, not a practicing structural engineer, correct?", "type": "exhibit", "keywords": ["yes", "correct", "that is right"] },
        { "q": "You have never personally designed a high-rise building, have you?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "That student's paper was not peer-reviewed or published in a recognized structural engineering journal?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Your academic model uses assumed parameters for wind speed and direction. Those are estimates, not measurements?", "type": "normal", "keywords": ["wind", "quartering", "lateral", "load"] },
        { "q": "The building has experienced real wind events over the past decade and has not failed, correct?", "type": "normal", "keywords": ["wind", "quartering", "lateral", "load", "engineer", "licensed", "years", "degree"] },
        { "q": "Bolted shear connections are used in high-rise construction throughout the country, aren't they?", "type": "normal", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "OUTRO", "statement": "Thank you. No further questions." }
      ]
    }
  },
  "defense": {
    "Cam Martinez": {
      "direct": [
        { "q": "Please state your name for the record.", "type": "intro", "keywords": ["martinez", "my name is", "name is"] },
        { "q": "What was your role in the East Superior Residential Tower project?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Did Metro Builders construct the building according to the plans provided by Apex Engineering?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Was there a written change order authorizing the substitution of bolted for welded connections?", "type": "exhibit", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "Who reviewed and approved that change order?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Did the city inspector review and approve the structural framework including the connections?", "type": "hard", "keywords": ["connection", "bolted", "welded", "shear", "moment", "inspection", "code", "certificate", "passed"] },
        { "q": "Did Metro Builders receive a certificate of occupancy at the conclusion of construction?", "type": "normal", "keywords": ["inspection", "code", "certificate", "passed"] },
        { "q": "What is Metro Builders' position regarding the plaintiffs' claims in this lawsuit?", "type": "exhibit", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Did you ever have any reason to doubt the safety of the bolted connections?", "type": "normal", "keywords": ["doubt", "safety", "concern", "worry"] },
        { "q": "How would you describe your working relationship with Apex Engineering?", "type": "normal", "keywords": ["apex", "engineer", "work", "relationship"] },
        { "q": "OUTRO", "statement": "Thank you. No further questions." }
      ],
      "cross": [
        { "q": "Please state your name for the record.", "type": "intro", "keywords": ["martinez", "my name is", "name is"] },
        { "q": "Mr. Martinez, the connection substitution reduced construction costs by approximately fourteen to eighteen percent, correct?", "type": "exhibit", "keywords": ["connection", "bolted", "welded", "shear", "moment", "cost", "percent", "million", "savings"] },
        { "q": "Metro Builders proposed the substitution from welded to bolted connections, didn't it?", "type": "normal", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "The connection change also shortened the construction timeline by over three months?", "type": "normal", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "You are not a licensed structural engineer, correct?", "type": "exhibit", "keywords": ["yes", "correct", "that is right"] },
        { "q": "You relied on Apex Engineering's approval to determine whether the substitution was safe?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Metro Builders stood to lose money if the project was delayed — that's a fact, correct?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "You received a bonus for completing the project ahead of schedule, didn't you?", "type": "hard", "keywords": ["bonus", "money", "schedule", "early"] },
        { "q": "So you had a financial incentive to cut corners?", "type": "hard", "keywords": ["financial", "incentive", "cut", "corner"] },
        { "q": "OUTRO", "statement": "Nothing further. The record speaks for itself." }
      ]
    },
    "Whitley Carter": {
      "direct": [
        { "q": "Please state your name for the record.", "type": "intro", "keywords": ["carter", "my name is", "name is"] },
        { "q": "How many years did you work as a city building inspector?", "type": "normal", "keywords": ["inspection", "code", "certificate", "passed"] },
        { "q": "Can you describe the inspection process for a high-rise structural steel framework?", "type": "hard", "keywords": ["inspection", "code", "certificate", "passed"] },
        { "q": "Did the structural framework of the East Superior Tower pass your inspection?", "type": "normal", "keywords": ["inspection", "code", "certificate", "passed"] },
        { "q": "What is the significance of the certificate of occupancy you issued?", "type": "exhibit", "keywords": ["inspection", "code", "certificate", "passed"] },
        { "q": "Did you observe anything during your inspection that raised safety concerns?", "type": "normal", "keywords": ["inspection", "code", "certificate", "passed"] },
        { "q": "In your professional experience, was this inspection consistent with standard procedure?", "type": "normal", "keywords": ["inspection", "code", "certificate", "passed", "engineer", "licensed", "years", "degree"] },
        { "q": "OUTRO", "statement": "Thank you. No further questions." }
      ],
      "cross": [
        { "q": "Please state your name for the record.", "type": "intro", "keywords": ["carter", "my name is", "name is"] },
        { "q": "Ms. Carter, you conducted the structural inspection on this building before it opened?", "type": "exhibit", "keywords": ["inspection", "code", "certificate", "passed"] },
        { "q": "You did not specifically test the load-bearing capacity of the connections during your inspection?", "type": "normal", "keywords": ["connection", "bolted", "welded", "shear", "moment", "inspection", "code", "certificate", "passed"] },
        { "q": "A visual inspection of bolted connections does not evaluate whether the connection type is appropriate for the loading conditions, does it?", "type": "hard", "keywords": ["connection", "bolted", "welded", "shear", "moment", "inspection", "code", "certificate", "passed"] },
        { "q": "The building code in effect at the time of your inspection did not require quartering wind analysis?", "type": "normal", "keywords": ["wind", "quartering", "lateral", "load", "inspection", "code", "certificate", "passed"] },
        { "q": "So your inspection could not have detected the quartering wind vulnerability, could it?", "type": "exhibit", "keywords": ["wind", "quartering", "lateral", "load", "inspection", "code", "certificate", "passed"] },
        { "q": "You were not provided with the change order documentation showing the substitution from welded to bolted connections?", "type": "normal", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "OUTRO", "statement": "That will be all. Thank you." }
      ]
    },
    "Ash Forrester": {
      "direct": [
        { "q": "Please state your name for the record.", "type": "intro", "keywords": ["forrester", "my name is", "name is"] },
        { "q": "Dr. Forrester, can you describe your professional background?", "type": "normal", "keywords": ["engineer", "licensed", "years", "degree"] },
        { "q": "What was the scope of your review for the East Superior Residential Tower?", "type": "hard", "keywords": ["yes", "correct", "that is right"] },
        { "q": "What is your professional opinion regarding the structural integrity of the East Superior Tower as built?", "type": "exhibit", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Did the use of bolted shear connections comply with the applicable building codes at the time of construction?", "type": "normal", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "What is your assessment of Dr. Hightower's quartering wind analysis?", "type": "normal", "keywords": ["wind", "quartering", "lateral", "load"] },
        { "q": "Was the retrofit that was performed on the building actually necessary?", "type": "normal", "keywords": ["retrofit", "repair", "reinforcement", "weld"] },
        { "q": "In your professional opinion, did Apex Engineering meet the standard of care applicable to structural engineers at the time of design?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "OUTRO", "statement": "No further questions, your Honor." }
      ],
      "cross": [
        { "q": "Please state your name for the record.", "type": "intro", "keywords": ["forrester", "my name is", "name is"] },
        { "q": "Dr. Forrester, you were retained by the defense in this case, correct?", "type": "exhibit", "keywords": ["yes", "correct", "that is right"] },
        { "q": "Your firm has previously consulted for Apex Engineering on other projects, hasn't it?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "You would agree that welded moment connections provide greater lateral load resistance than bolted shear connections?", "type": "hard", "keywords": ["connection", "bolted", "welded", "shear", "moment"] },
        { "q": "The substitution was proposed by Metro Builders after they reviewed the cost savings it would generate?", "type": "normal", "keywords": ["cost", "percent", "million", "savings"] },
        { "q": "You would agree that the building code represents a minimum standard, not an optimal standard?", "type": "normal", "keywords": ["yes", "correct", "that is right"] },
        { "q": "You would agree that if the quartering wind scenario Dr. Hightower described were to occur, and the connections failed, it would be catastrophic?", "type": "normal", "keywords": ["connection", "bolted", "welded", "shear", "moment", "wind", "quartering", "lateral", "load"] },
        { "q": "OUTRO", "statement": "Nothing further. The record speaks for itself." }
      ]
    }
  }
};

// ScriptsDB.js
window.MockScriptsDB = {
  "easy": [
    { "speaker": "Lawyer", "text": "Please state your name for the record.", "isViolation": false },
    { "speaker": "Witness", "text": "My name is Dr. Rowan Hightower. I am a licensed professional engineer in the state of Michigan.", "isViolation": false },
    { "speaker": "Lawyer", "text": "Thank you, Dr. Hightower. Can you briefly describe your professional background?", "isViolation": false },
    { "speaker": "Witness", "text": "I hold dual doctorates from MIT and Johns Hopkins and have over twenty-five years of experience in structural engineering and occupational safety.", "isViolation": false },
    { "speaker": "Lawyer", "text": "I never reviewed the original drawings myself, but I know for a fact the engineers ignored the safety issues.", "isViolation": true, "ruleNum": "602", "ruleName": "Lack of Personal Knowledge", "reason": "The witness lacks personal knowledge of the facts asserted." },
    { "speaker": "Witness", "text": "The memo was leaked to the HOA after Mr. Greene became concerned that Apex would not act on his findings internally.", "isViolation": false },
    { "speaker": "Lawyer", "text": "The executives at Apex are corrupt criminals who have destroyed this community and deserve to lose everything they own.", "isViolation": true, "ruleNum": "403", "ruleName": "Prejudicial", "reason": "The probative value is substantially outweighed by the danger of unfair prejudice." },
    { "speaker": "Witness", "text": "Upon receiving the memo, the HOA president contacted Dr. Ellis Chen to conduct an independent review of the concerns raised.", "isViolation": false },
    { "speaker": "Lawyer", "text": "Metro Builders has a long history of ignoring safety regulations on every project they touch.", "isViolation": true, "ruleNum": "404", "ruleName": "Improper Character Evidence", "reason": "Evidence of prior bad acts is not admissible to prove propensity." },
    { "speaker": "Witness", "text": "The findings in the whistleblower memo were consistent with what the independent engineering experts later confirmed.", "isViolation": false },
    { "speaker": "Lawyer", "text": "Well, I heard one of the engineers say the building was about to fall down.", "isViolation": true, "ruleNum": "802", "ruleName": "Hearsay", "reason": "The statement is an out-of-court assertion offered for the truth of the matter asserted." },
    { "speaker": "Witness", "text": "According to Exhibit Number 10, the retrofit cost approximately four million dollars.", "isViolation": false },
    { "speaker": "Lawyer", "text": "So you agree that the building is unsafe, don't you?", "isViolation": true, "ruleNum": "611", "ruleName": "Leading Question (Direct Only)", "reason": "Counsel is leading the witness on direct examination." },
    { "speaker": "Witness", "text": "In my opinion as a homeowner, the steel was defective.", "isViolation": true, "ruleNum": "701", "ruleName": "Improper Lay Opinion", "reason": "A lay witness may not offer opinions requiring specialized knowledge." }
  ],
  "medium": [
    { "speaker": "Lawyer", "text": "Please state your name for the record.", "isViolation": false },
    { "speaker": "Witness", "text": "My name is Reed Alvarez. I am the President of the HOA.", "isViolation": false },
    { "speaker": "Lawyer", "text": "Mr. Alvarez, when did you first learn about the structural issues?", "isViolation": false },
    { "speaker": "Witness", "text": "I received a call from my sister, who told me she read on a blog that the building was dangerous.", "isViolation": true, "ruleNum": "802", "ruleName": "Hearsay", "reason": "The witness is testifying to what his sister said, which is hearsay." },
    { "speaker": "Lawyer", "text": "Did you verify this information?", "isViolation": false },
    { "speaker": "Witness", "text": "I tried, but the engineers were clearly hiding something. You could see the guilt in their eyes.", "isViolation": true, "ruleNum": "602", "ruleName": "Lack of Personal Knowledge / Speculation", "reason": "Witness is speculating about the engineers' state of mind." },
    { "speaker": "Lawyer", "text": "Let's talk about the retrofit. It was expensive, wasn't it?", "isViolation": true, "ruleNum": "611", "ruleName": "Leading Question", "reason": "Counsel is suggesting the answer." },
    { "speaker": "Witness", "text": "Yes, it cost us millions. And frankly, the developer is a known cheapskate who cuts corners on every job.", "isViolation": true, "ruleNum": "404", "ruleName": "Improper Character Evidence", "reason": "Character evidence used to show propensity." },
    { "speaker": "Lawyer", "text": "Is it your opinion that the building is now safe?", "isViolation": false },
    { "speaker": "Witness", "text": "Based on my experience living there, the vibrations have stopped, so structurally it must be sound.", "isViolation": true, "ruleNum": "701", "ruleName": "Improper Lay Opinion", "reason": "Lay witness giving technical structural opinion." }
  ],
  "hard": [
    { "speaker": "Lawyer", "text": "Please state your name for the record.", "isViolation": false },
    { "speaker": "Witness", "text": "My name is Dr. Rowan Hightower. I am a licensed professional engineer in the state of Michigan.", "isViolation": false },
    { "speaker": "Witness", "text": "Based on what I overheard at the HOA meeting, and what my neighbor later confirmed to me, I believe the decision to substitute the connections was entirely financially motivated.", "isViolation": true, "ruleNum": "701", "ruleName": "Improper Lay Opinion", "reason": "The witness is offering a technical expert opinion without qualifying as an expert." },
    { "speaker": "Lawyer", "text": "Were quartering wind loads considered in the original design calculations?", "isViolation": false },
    { "speaker": "Witness", "text": "The HOA voted fifty-one to forty-nine percent to proceed with the emergency retrofit. It was not a unanimous decision, but it was the right one.", "isViolation": false },
    { "speaker": "Lawyer", "text": "Would you say that Apex is the kind of company that prioritizes profit over people?", "isViolation": true, "ruleNum": "403", "ruleName": "Prejudicial", "reason": "The probative value is substantially outweighed by the danger of unfair prejudice." },
    { "speaker": "Witness", "text": "I didn't see the change order myself, but everyone knows it was rushed through.", "isViolation": true, "ruleNum": "602", "ruleName": "Lack of Personal Knowledge", "reason": "The witness lacks personal knowledge of the facts asserted." },
    { "speaker": "Lawyer", "text": "You've admitted that you've been accused of negligence before, haven't you?", "isViolation": true, "ruleNum": "404", "ruleName": "Improper Character Evidence", "reason": "Evidence of prior bad acts is not admissible to prove propensity." },
    { "speaker": "Witness", "text": "I heard from my neighbor who heard from a contractor that the inspector was paid off.", "isViolation": true, "ruleNum": "805", "ruleName": "Double Hearsay", "reason": "Hearsay within hearsay." },
    { "speaker": "Lawyer", "text": "Dr. Hightower, referring to Exhibit 4, does this chart accurately represent the wind tunnel data?", "isViolation": false },
    { "speaker": "Witness", "text": "Yes, it shows the vortex shedding frequency.", "isViolation": false },
    { "speaker": "Lawyer", "text": "And this frequency proves the building would collapse, correct?", "isViolation": true, "ruleNum": "611", "ruleName": "Leading Question", "reason": "Leading on direct (assuming direct exam context)." },
    { "speaker": "Witness", "text": "Well, the data suggests a high probability of failure.", "isViolation": false },
    { "speaker": "Lawyer", "text": "Is it possible the wind tunnel model was flawed?", "isViolation": false },
    { "speaker": "Witness", "text": "Anything is possible, but Dr. Chen is a genius who never makes mistakes.", "isViolation": true, "ruleNum": "608", "ruleName": "Bolstering Character", "reason": "Bolstering credibility before it has been attacked." }
  ]
};
