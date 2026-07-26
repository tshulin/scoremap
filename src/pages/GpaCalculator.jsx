/**
 * GPA calculator — a device-local, one-semester planning tool.
 *
 * Every course is weighted equally. A weighted course adds one grade point to
 * passing grades for the weighted result; the unweighted result always uses
 * the standard four-point scale.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { GPA_GRADES, gpaPoints, semesterGpa } from '../calc/index';
import Sidebar from '../components/Sidebar.jsx';
import './GpaCalculator.css';

const STORAGE_KEY = 'grademax-gpa-calculator-v1';
let courseSequence = 0;

const newCourse = () => ({
  id: `gpa-course-${Date.now()}-${courseSequence++}`,
  name: '',
  grade: 'A',
  weighted: false,
});

const defaultCourses = () => Array.from({ length: 6 }, newCourse);

const loadCourses = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!Array.isArray(stored) || stored.length === 0) return defaultCourses();

    const courses = stored
      .filter((course) => course && GPA_GRADES.includes(course.grade))
      .map((course) => ({
        id: typeof course.id === 'string' ? course.id : newCourse().id,
        name: typeof course.name === 'string' ? course.name : '',
        grade: course.grade,
        weighted: course.weighted === true,
      }));

    return courses.length > 0 ? courses : defaultCourses();
  } catch {
    return defaultCourses();
  }
};

const formatGpa = (value) => (value == null ? '—' : value.toFixed(2));

function GpaCalculator() {
  const [courses, setCourses] = useState(loadCourses);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
    } catch {
      // The calculator remains usable when browser storage is unavailable.
    }
  }, [courses]);

  const results = useMemo(() => semesterGpa(courses), [courses]);
  const weightedCount = courses.filter((course) => course.weighted).length;

  const updateCourse = (id, field, value) => {
    setCourses((current) =>
      current.map((course) => (course.id === id ? { ...course, [field]: value } : course)),
    );
  };

  const removeCourse = (id) => {
    setCourses((current) => (current.length > 1 ? current.filter((course) => course.id !== id) : current));
  };

  return (
    <div className="gpa-page">
      <Sidebar />

      <main className="gpa-main">
        <div className="gpa-shell">
          <header className="gpa-header">
            <div>
              <h1>GPA calculator</h1>
              <p>Estimate your weighted and unweighted GPA for one semester.</p>
            </div>
          </header>

          <div className="gpa-layout">
            <section className="gpa-course-card" aria-labelledby="semester-courses-heading">
              <div className="gpa-card-heading">
                <div>
                  <h2 id="semester-courses-heading">Semester courses</h2>
                  <p>
                    {courses.length} {courses.length === 1 ? 'course' : 'courses'} · {weightedCount}{' '}
                    weighted
                  </p>
                </div>
                <button type="button" className="gpa-add-button" onClick={() => setCourses((current) => [...current, newCourse()])}>
                  Add course
                </button>
              </div>

              <div className="gpa-table" role="table" aria-label="Semester courses">
                <div className="gpa-table-header" role="row">
                  <span role="columnheader">Course</span>
                  <span role="columnheader">Grade</span>
                  <span role="columnheader">Type</span>
                  <span role="columnheader" className="gpa-remove-heading">
                    Remove
                  </span>
                </div>

                <div role="rowgroup">
                  {courses.map((course, index) => (
                    <div className="gpa-course-row" role="row" key={course.id}>
                      <label className="gpa-field gpa-name-field">
                        <span>Course {index + 1}</span>
                        <input
                          type="text"
                          value={course.name}
                          placeholder={`Course ${index + 1}`}
                          aria-label={`Course ${index + 1} name`}
                          onChange={(event) => updateCourse(course.id, 'name', event.target.value)}
                        />
                      </label>

                      <label className="gpa-field">
                        <span>Grade</span>
                        <select
                          value={course.grade}
                          aria-label={`${course.name || `Course ${index + 1}`} grade`}
                          onChange={(event) => updateCourse(course.id, 'grade', event.target.value)}
                        >
                          {GPA_GRADES.map((grade) => (
                            <option value={grade} key={grade}>
                              {grade}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="gpa-field">
                        <span>Type</span>
                        <select
                          value={course.weighted ? 'weighted' : 'unweighted'}
                          aria-label={`${course.name || `Course ${index + 1}`} type`}
                          onChange={(event) => updateCourse(course.id, 'weighted', event.target.value === 'weighted')}
                        >
                          <option value="unweighted">Unweighted</option>
                          <option value="weighted">Weighted</option>
                        </select>
                      </label>

                      <div className="gpa-course-points" aria-label={`${gpaPoints(course.grade, course.weighted)} grade points`}>
                        {gpaPoints(course.grade, course.weighted).toFixed(1)} pts
                      </div>

                      <button
                        type="button"
                        className="gpa-remove-button"
                        aria-label={`Remove ${course.name || `course ${index + 1}`}`}
                        disabled={courses.length === 1}
                        onClick={() => removeCourse(course.id)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <button type="button" className="gpa-add-button gpa-add-button-bottom" onClick={() => setCourses((current) => [...current, newCourse()])}>
                Add course
              </button>
            </section>

            <aside className="gpa-summary-card" aria-live="polite">
              <div className="gpa-summary-heading">
                <p>Semester results</p>
                <span>Updates as you edit</span>
              </div>

              <div className="gpa-result">
                <span>Unweighted GPA</span>
                <strong>{formatGpa(results?.unweighted)}</strong>
                <small>4.00 scale</small>
              </div>

              <div className="gpa-result">
                <span>Weighted GPA</span>
                <strong>{formatGpa(results?.weighted)}</strong>
                <small>5.00 scale</small>
              </div>

              <p className="gpa-summary-note">
                Every course counts equally. Weighted courses add one point to passing grades.
              </p>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

export default GpaCalculator;
