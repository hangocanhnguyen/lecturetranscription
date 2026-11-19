# Lectureleaf
Ứng dụng web tĩnh ghi âm bài giảng bằng micro hoặc đọc audio từ file video/audio, chép lời kèm thời gian bằng Whisper Tiny (mặc định) hoặc Base đa ngôn ngữ, tạo dàn ý và xuất Markdown. Micro ghi âm trước, người dùng chạy chép lời sau khi dừng. Mốc thời gian cho phép nghe lại nguồn.

## Dùng trên máy
Chạy `python3 -m http.server 8000 --directory dist` từ thư mục dự án. Mở http://localhost:8000. Micro cần localhost hoặc HTTPS. Thử Chrome/Edge desktop. File được giải mã bằng codec trình duyệt hỗ trợ. Nếu MOV/MP4 không đọc được, chuyển audio thành MP3/WAV.

## GitHub Pages
Giải nén rồi đẩy toàn bộ nội dung vào nhánh main của repo GitHub. Trong Settings → Pages → Build and deployment, chọn GitHub Actions. Chạy workflow “Publish Lectureleaf” trong tab Actions hoặc push thay đổi lên main. Workflow xuất bản thư mục dist. Mọi đường dẫn asset đều tương đối. Có thể dùng bất kỳ static host HTTPS nào.

## Xử lý và dữ liệu
Không cần tài khoản hoặc API key. Trình duyệt tải Transformers.js 2.17.2 và WebAssembly từ jsDelivr, mô hình Xenova/whisper-tiny.en cho tiếng Anh, Xenova/whisper-tiny cho ngôn ngữ khác hoặc Xenova/whisper-base ở chế độ Kỹ hơn từ Hugging Face. Âm thanh và văn bản ở trên máy. Cache mô hình tùy trình duyệt. Nội dung bài giảng nằm trong bộ nhớ của tab, tải bản ghi và Markdown để lưu. Ghi âm dùng micro, bao gồm khi người dùng nghe giảng qua loa ngoài.
 
Chọn ngôn ngữ giảng để hỗ trợ nhận diện. Worker nhận audio mono 16 kHz, chia đoạn gần 2 phút theo khoảng lặng rồi chạy Whisper với cửa sổ chồng lấn. Dàn ý trích xuất câu đại diện theo từ khóa trong mỗi khoảng 2,5 phút và chọn tối đa bốn câu bổ sung, giữ nguyên ngôn ngữ gốc. Đây là tóm tắt trích xuất. Tên riêng, thuật ngữ, đoạn nhiễu và mốc thời gian cần đối chiếu khi dùng để học. Bài dài có thể cần nhiều RAM do giải mã toàn bộ audio đầu vào. Có thể chia file thành các phần ngắn hơn.

## Tốc độ
Chế độ Nhanh dùng mô hình Tiny lượng tử hóa, đổi lại độ chính xác có thể giảm. Mô hình được giữ trong worker sau khi hoàn tất để tái sử dụng cho file tiếp theo. Hủy xử lý giải phóng worker ngay. Đổi chế độ/ngôn ngữ có thể cần tải mô hình khác. Thời gian chuẩn bị mô hình và xử lý audio được hiển thị riêng. Tốc độ thực tế phụ thuộc thiết bị và âm thanh.
